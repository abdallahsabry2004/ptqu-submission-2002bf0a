
-- 1) Drop the trigger that tries to delete from storage.objects directly
--    (Supabase blocks this with the storage.protect_delete trigger).
DROP TRIGGER IF EXISTS trg_delete_submission_storage ON public.submissions;
DROP FUNCTION IF EXISTS public.delete_submission_storage_file();

-- 2) Allow supervisors (and admins) to bypass the student-update guard
CREATE OR REPLACE FUNCTION public.guard_submission_student_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Admins and supervisors of the assignment bypass this guard
  IF public.is_admin(auth.uid())
     OR public.supervises_assignment(auth.uid(), NEW.assignment_id) THEN
    RETURN NEW;
  END IF;

  -- For everyone else (the student themselves, group members), block changes
  -- to admin/reviewer-only columns.
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.reviewer_notes IS DISTINCT FROM OLD.reviewer_notes
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.is_late IS DISTINCT FROM OLD.is_late
     OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
     OR NEW.group_id IS DISTINCT FROM OLD.group_id
  THEN
    RAISE EXCEPTION 'Only reviewers can modify status, reviewer notes, reviewed_at, is_late, assignment_id, or group_id';
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Ensure national_id is globally unique (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_national_id_unique'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_national_id_unique UNIQUE (national_id);
  END IF;
END$$;
