
-- 1. Trigger to prevent students from changing admin-controlled columns on submissions
CREATE OR REPLACE FUNCTION public.guard_submission_student_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass this guard
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- For non-admins (the student themselves), block changes to admin-only columns
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.reviewer_notes IS DISTINCT FROM OLD.reviewer_notes
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.is_late IS DISTINCT FROM OLD.is_late
     OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
  THEN
    RAISE EXCEPTION 'Students cannot modify status, reviewer notes, reviewed_at, is_late, student_id, or assignment_id';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_submission_student_update ON public.submissions;
CREATE TRIGGER trg_guard_submission_student_update
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_submission_student_update();

-- 2. Server-side enforcement of late_policy = 'block' on insert
CREATE OR REPLACE FUNCTION public.student_can_submit_assignment(_user uuid, _assignment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.student_can_see_assignment(_user, _assignment_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = _assignment_id
        AND a.late_policy = 'block'
        AND a.due_date IS NOT NULL
        AND now() > a.due_date
    )
$$;

DROP POLICY IF EXISTS "Students insert own submissions" ON public.submissions;
CREATE POLICY "Students insert own submissions"
  ON public.submissions
  FOR INSERT
  WITH CHECK (
    auth.uid() = student_id
    AND public.student_can_submit_assignment(auth.uid(), assignment_id)
  );

-- 3. Restrict profile inserts to admins only (edge function uses service role and bypasses RLS)
DROP POLICY IF EXISTS "Admins insert profiles" ON public.profiles;
CREATE POLICY "Admins insert profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- 4. Tighten storage policies for the submissions bucket
-- Drop any existing submissions storage policies to recreate them
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (policyname ILIKE '%submission%' OR policyname ILIKE '%Students upload submissions%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Students can read their own submission files (must match an existing submission record they own)
CREATE POLICY "Students read own submission files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'submissions'
    AND (
      EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.file_path = storage.objects.name
          AND s.student_id = auth.uid()
      )
      OR public.is_admin(auth.uid())
    )
  );

-- Students can upload to their own folder for assignments they can submit to
CREATE POLICY "Students upload own submission files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'submissions'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id::text = (storage.foldername(name))[2]
        AND public.student_can_submit_assignment(auth.uid(), a.id)
    )
  );

-- Students can delete their own files (and admins anything)
CREATE POLICY "Students delete own submission files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'submissions'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_admin(auth.uid())
    )
  );

-- Admins manage all
CREATE POLICY "Admins manage submission files"
  ON storage.objects
  FOR ALL
  USING (bucket_id = 'submissions' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'submissions' AND public.is_admin(auth.uid()));
