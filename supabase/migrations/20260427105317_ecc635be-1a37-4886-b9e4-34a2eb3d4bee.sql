ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS whatsapp_number text;

CREATE OR REPLACE FUNCTION public.list_course_groups(_course_id uuid)
RETURNS TABLE(group_id uuid, group_name text, student_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.supervises_course(auth.uid(), _course_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    g.id AS group_id,
    g.name AS group_name,
    gm.student_id
  FROM public.groups g
  LEFT JOIN public.group_members gm ON gm.group_id = g.id
  WHERE g.course_id = _course_id
  ORDER BY g.created_at, g.name, gm.created_at;
END;
$$;