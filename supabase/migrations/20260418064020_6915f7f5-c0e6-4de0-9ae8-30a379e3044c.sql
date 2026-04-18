
-- ============================================
-- 1) course_supervisors link table
-- ============================================
CREATE TABLE IF NOT EXISTS public.course_supervisors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  supervisor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, supervisor_id)
);

ALTER TABLE public.course_supervisors ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2) Helper functions
-- ============================================
CREATE OR REPLACE FUNCTION public.is_supervisor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'supervisor'
  )
$$;

CREATE OR REPLACE FUNCTION public.supervises_course(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_supervisors
    WHERE supervisor_id = _user_id AND course_id = _course_id
  )
$$;

CREATE OR REPLACE FUNCTION public.supervises_assignment(_user_id uuid, _assignment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.course_supervisors cs ON cs.course_id = a.course_id
    WHERE a.id = _assignment_id AND cs.supervisor_id = _user_id
  )
$$;

-- ============================================
-- 3) course_supervisors RLS (admin only)
-- ============================================
DROP POLICY IF EXISTS "Admins manage course supervisors" ON public.course_supervisors;
CREATE POLICY "Admins manage course supervisors"
  ON public.course_supervisors FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Supervisors view own assignments" ON public.course_supervisors;
CREATE POLICY "Supervisors view own assignments"
  ON public.course_supervisors FOR SELECT
  USING (auth.uid() = supervisor_id);

-- ============================================
-- 4) Extend existing RLS to grant supervisors access
-- ============================================

-- COURSES: supervisors view their assigned courses
DROP POLICY IF EXISTS "Supervisors view assigned courses" ON public.courses;
CREATE POLICY "Supervisors view assigned courses"
  ON public.courses FOR SELECT
  USING (supervises_course(auth.uid(), id));

-- COURSE_STUDENTS: supervisors view rows of their courses
DROP POLICY IF EXISTS "Supervisors view course students" ON public.course_students;
CREATE POLICY "Supervisors view course students"
  ON public.course_students FOR SELECT
  USING (supervises_course(auth.uid(), course_id));

-- GROUPS: supervisors view groups in their courses
DROP POLICY IF EXISTS "Supervisors view course groups" ON public.groups;
CREATE POLICY "Supervisors view course groups"
  ON public.groups FOR SELECT
  USING (supervises_course(auth.uid(), course_id));

-- GROUP_MEMBERS
DROP POLICY IF EXISTS "Supervisors view group members" ON public.group_members;
CREATE POLICY "Supervisors view group members"
  ON public.group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_members.group_id
        AND supervises_course(auth.uid(), g.course_id)
    )
  );

-- ASSIGNMENTS: supervisors manage assignments in their courses (insert/update/delete/select)
DROP POLICY IF EXISTS "Supervisors view course assignments" ON public.assignments;
CREATE POLICY "Supervisors view course assignments"
  ON public.assignments FOR SELECT
  USING (supervises_course(auth.uid(), course_id));

DROP POLICY IF EXISTS "Supervisors create assignments" ON public.assignments;
CREATE POLICY "Supervisors create assignments"
  ON public.assignments FOR INSERT
  WITH CHECK (supervises_course(auth.uid(), course_id));

DROP POLICY IF EXISTS "Supervisors update assignments" ON public.assignments;
CREATE POLICY "Supervisors update assignments"
  ON public.assignments FOR UPDATE
  USING (supervises_course(auth.uid(), course_id))
  WITH CHECK (supervises_course(auth.uid(), course_id));

DROP POLICY IF EXISTS "Supervisors delete assignments" ON public.assignments;
CREATE POLICY "Supervisors delete assignments"
  ON public.assignments FOR DELETE
  USING (supervises_course(auth.uid(), course_id));

-- SUBMISSIONS: supervisors view & update submissions in their courses
DROP POLICY IF EXISTS "Supervisors view submissions" ON public.submissions;
CREATE POLICY "Supervisors view submissions"
  ON public.submissions FOR SELECT
  USING (supervises_assignment(auth.uid(), assignment_id));

DROP POLICY IF EXISTS "Supervisors update submissions" ON public.submissions;
CREATE POLICY "Supervisors update submissions"
  ON public.submissions FOR UPDATE
  USING (supervises_assignment(auth.uid(), assignment_id))
  WITH CHECK (supervises_assignment(auth.uid(), assignment_id));

DROP POLICY IF EXISTS "Supervisors delete submissions" ON public.submissions;
CREATE POLICY "Supervisors delete submissions"
  ON public.submissions FOR DELETE
  USING (supervises_assignment(auth.uid(), assignment_id));

-- PROFILES: supervisors view profiles of students in their courses (for names)
DROP POLICY IF EXISTS "Supervisors view course student profiles" ON public.profiles;
CREATE POLICY "Supervisors view course student profiles"
  ON public.profiles FOR SELECT
  USING (
    is_supervisor(auth.uid()) AND EXISTS (
      SELECT 1 FROM public.course_students cs
      JOIN public.course_supervisors csv ON csv.course_id = cs.course_id
      WHERE cs.student_id = profiles.id AND csv.supervisor_id = auth.uid()
    )
  );

-- USER_ROLES: supervisors view their own role (already covered by "Users view own roles")

-- STORAGE: supervisors download files in their courses
DROP POLICY IF EXISTS "Supervisors read course submission files" ON storage.objects;
CREATE POLICY "Supervisors read course submission files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'submissions'
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.file_path = storage.objects.name
        AND public.supervises_assignment(auth.uid(), s.assignment_id)
    )
  );

-- ============================================
-- 5) Update admin national_id to 30409302705170
-- ============================================
DO $$
DECLARE
  admin_uid uuid;
BEGIN
  SELECT user_id INTO admin_uid FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF admin_uid IS NOT NULL THEN
    UPDATE public.profiles SET national_id = '30409302705170' WHERE id = admin_uid;
    UPDATE auth.users
      SET email = '30409302705170@admin.local',
          raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{national_id}', '"30409302705170"')
      WHERE id = admin_uid;
  END IF;
END $$;
