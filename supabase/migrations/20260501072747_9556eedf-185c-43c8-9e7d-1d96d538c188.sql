-- إزالة قيد الفريدية الذي يمنع أكثر من تسليم في نفس المجموعة (per_student)
DROP INDEX IF EXISTS public.submissions_per_group_unique;

-- إنشاء trigger يفرض التفرد فقط في وضع one_per_group
CREATE OR REPLACE FUNCTION public.enforce_group_submission_uniqueness()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mode group_submission_mode;
BEGIN
  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT group_submission_mode INTO _mode
  FROM public.assignments
  WHERE id = NEW.assignment_id;

  IF _mode = 'one_per_group' THEN
    IF EXISTS (
      SELECT 1 FROM public.submissions
      WHERE assignment_id = NEW.assignment_id
        AND group_id = NEW.group_id
        AND id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'يوجد تسليم بالفعل لهذه المجموعة (وضع تسليم واحد للمجموعة)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_group_submission_uniqueness_trg ON public.submissions;
CREATE TRIGGER enforce_group_submission_uniqueness_trg
BEFORE INSERT OR UPDATE ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_group_submission_uniqueness();