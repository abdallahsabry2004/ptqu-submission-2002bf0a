
-- ============== ENUMS ==============
CREATE TYPE public.app_role AS ENUM ('admin', 'student');
CREATE TYPE public.submission_status AS ENUM ('pending', 'approved', 'rejected', 'resubmit_requested');
CREATE TYPE public.assignment_scope AS ENUM ('course', 'group');
CREATE TYPE public.late_policy AS ENUM ('block', 'allow_marked_late');

-- ============== UTIL FUNCTION ==============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============== PROFILES ==============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  national_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== USER ROLES ==============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer functions to check roles (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- ============== COURSES ==============
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER courses_updated BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== COURSE_STUDENTS ==============
CREATE TABLE public.course_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, student_id)
);
ALTER TABLE public.course_students ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_course_students_student ON public.course_students(student_id);
CREATE INDEX idx_course_students_course ON public.course_students(course_id);

-- ============== GROUPS ==============
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, student_id)
);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_group_members_student ON public.group_members(student_id);

-- ============== ASSIGNMENTS ==============
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  late_policy public.late_policy NOT NULL DEFAULT 'allow_marked_late',
  scope public.assignment_scope NOT NULL DEFAULT 'course',
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((scope = 'course' AND group_id IS NULL) OR (scope = 'group' AND group_id IS NOT NULL))
);
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER assignments_updated BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_assignments_course ON public.assignments(course_id);

-- ============== SUBMISSIONS ==============
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  status public.submission_status NOT NULL DEFAULT 'pending',
  is_late BOOLEAN NOT NULL DEFAULT false,
  reviewer_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER submissions_updated BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_submissions_assignment ON public.submissions(assignment_id);
CREATE INDEX idx_submissions_student ON public.submissions(student_id);

-- ============== HELPER: is student in assignment scope ==============
CREATE OR REPLACE FUNCTION public.student_can_see_assignment(_user UUID, _assignment_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assignments a
    WHERE a.id = _assignment_id
      AND (
        (a.scope = 'course' AND EXISTS (
          SELECT 1 FROM public.course_students cs
          WHERE cs.course_id = a.course_id AND cs.student_id = _user
        ))
        OR
        (a.scope = 'group' AND EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = a.group_id AND gm.student_id = _user
        ))
      )
  )
$$;

-- ============== RLS POLICIES ==============

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins update any profile" ON public.profiles
  FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR auth.uid() = id);
CREATE POLICY "Admins delete profiles" ON public.profiles
  FOR DELETE USING (public.is_admin(auth.uid()));

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- courses
CREATE POLICY "Admins manage courses" ON public.courses
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Students view their courses" ON public.courses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.course_students cs
            WHERE cs.course_id = courses.id AND cs.student_id = auth.uid())
  );

-- course_students
CREATE POLICY "Admins manage course students" ON public.course_students
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Students view own enrollments" ON public.course_students
  FOR SELECT USING (auth.uid() = student_id);

-- groups
CREATE POLICY "Admins manage groups" ON public.groups
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Students view groups in their courses" ON public.groups
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.course_students cs
            WHERE cs.course_id = groups.course_id AND cs.student_id = auth.uid())
  );

-- group_members
CREATE POLICY "Admins manage group members" ON public.group_members
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Students view group members of own groups" ON public.group_members
  FOR SELECT USING (
    auth.uid() = student_id OR
    EXISTS (SELECT 1 FROM public.group_members gm2
            WHERE gm2.group_id = group_members.group_id AND gm2.student_id = auth.uid())
  );

-- assignments
CREATE POLICY "Admins manage assignments" ON public.assignments
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Students view assigned assignments" ON public.assignments
  FOR SELECT USING (public.student_can_see_assignment(auth.uid(), id));

-- submissions
CREATE POLICY "Admins view all submissions" ON public.submissions
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins update submissions" ON public.submissions
  FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete submissions" ON public.submissions
  FOR DELETE USING (public.is_admin(auth.uid()));
CREATE POLICY "Students view own submissions" ON public.submissions
  FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students insert own submissions" ON public.submissions
  FOR INSERT WITH CHECK (
    auth.uid() = student_id
    AND public.student_can_see_assignment(auth.uid(), assignment_id)
  );
CREATE POLICY "Students update own submissions" ON public.submissions
  FOR UPDATE USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students delete own submissions" ON public.submissions
  FOR DELETE USING (auth.uid() = student_id);

-- ============== STORAGE BUCKET ==============
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: file path format = {student_id}/{assignment_id}/{filename}
CREATE POLICY "Students upload own submission files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'submissions'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Students read own submission files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'submissions'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Students delete own submission files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'submissions'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Students update own submission files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'submissions'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Admins manage all submission files" ON storage.objects
  FOR ALL USING (
    bucket_id = 'submissions' AND public.is_admin(auth.uid())
  ) WITH CHECK (
    bucket_id = 'submissions' AND public.is_admin(auth.uid())
  );

-- ============== AUTO-DELETE STORAGE FILE WHEN SUBMISSION DELETED ==============
CREATE OR REPLACE FUNCTION public.delete_submission_storage_file()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.file_path IS NOT NULL THEN
    DELETE FROM storage.objects
    WHERE bucket_id = 'submissions' AND name = OLD.file_path;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_delete_submission_storage
  BEFORE DELETE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.delete_submission_storage_file();

-- When updating submission with new file, also delete the old file (will be handled in app code by deleting old then inserting)
