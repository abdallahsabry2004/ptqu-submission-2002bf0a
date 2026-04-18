
-- Add FKs only if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_students_student_id_fkey'
  ) THEN
    ALTER TABLE public.course_students
      ADD CONSTRAINT course_students_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'group_members_student_id_fkey'
  ) THEN
    ALTER TABLE public.group_members
      ADD CONSTRAINT group_members_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'submissions_student_id_fkey'
  ) THEN
    ALTER TABLE public.submissions
      ADD CONSTRAINT submissions_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_national_id_unique'
  ) THEN
    -- Clean any existing duplicate first by keeping latest one
    DELETE FROM public.profiles p1
    USING public.profiles p2
    WHERE p1.national_id = p2.national_id
      AND p1.created_at < p2.created_at;

    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_national_id_unique UNIQUE (national_id);
  END IF;
END $$;

-- Add 'supervisor' to enum (must be its own statement, can't be in DO block easily for enum add)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';
