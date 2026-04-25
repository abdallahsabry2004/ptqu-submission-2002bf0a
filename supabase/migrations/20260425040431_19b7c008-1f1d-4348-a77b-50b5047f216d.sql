-- 1. Make national_id globally unique (cannot have two profiles with same national_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_national_id_unique'
  ) THEN
    BEGIN
      ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_national_id_unique UNIQUE (national_id);
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'Cannot add unique constraint on national_id due to existing duplicates. Resolve manually.';
    END;
  END IF;
END$$;

-- 2. Group submission mode on assignments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'group_submission_mode') THEN
    CREATE TYPE public.group_submission_mode AS ENUM ('per_student', 'one_per_group');
  END IF;
END$$;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS group_submission_mode public.group_submission_mode NOT NULL DEFAULT 'per_student';

-- 3. Allow submissions to be tied to a group (when one_per_group)
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS last_edited_by uuid;

-- Drop existing unique constraint on (assignment_id, student_id) if any, replace with conditional uniqueness
-- One submission per (assignment, student) when per-student; one submission per (assignment, group) when group mode
CREATE UNIQUE INDEX IF NOT EXISTS submissions_per_student_unique
  ON public.submissions (assignment_id, student_id)
  WHERE group_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS submissions_per_group_unique
  ON public.submissions (assignment_id, group_id)
  WHERE group_id IS NOT NULL;

-- 4. RLS: allow group members to view & edit a group submission for their assignment_group
DROP POLICY IF EXISTS "Group members view group submissions" ON public.submissions;
CREATE POLICY "Group members view group submissions"
ON public.submissions
FOR SELECT
USING (
  group_id IS NOT NULL
  AND public.student_in_assignment_group(auth.uid(), group_id)
);

DROP POLICY IF EXISTS "Group members insert group submissions" ON public.submissions;
CREATE POLICY "Group members insert group submissions"
ON public.submissions
FOR INSERT
WITH CHECK (
  group_id IS NOT NULL
  AND public.student_in_assignment_group(auth.uid(), group_id)
  AND public.student_can_submit_assignment(auth.uid(), assignment_id)
);

DROP POLICY IF EXISTS "Group members update group submissions" ON public.submissions;
CREATE POLICY "Group members update group submissions"
ON public.submissions
FOR UPDATE
USING (
  group_id IS NOT NULL
  AND public.student_in_assignment_group(auth.uid(), group_id)
)
WITH CHECK (
  group_id IS NOT NULL
  AND public.student_in_assignment_group(auth.uid(), group_id)
);

DROP POLICY IF EXISTS "Group members delete group submissions" ON public.submissions;
CREATE POLICY "Group members delete group submissions"
ON public.submissions
FOR DELETE
USING (
  group_id IS NOT NULL
  AND public.student_in_assignment_group(auth.uid(), group_id)
);

-- 5. Update guard trigger to allow last_edited_by + group_id changes for students (within constraints)
CREATE OR REPLACE FUNCTION public.guard_submission_student_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
     OR NEW.group_id IS DISTINCT FROM OLD.group_id
  THEN
    RAISE EXCEPTION 'Students cannot modify status, reviewer notes, reviewed_at, is_late, assignment_id, or group_id';
  END IF;

  RETURN NEW;
END;
$function$;