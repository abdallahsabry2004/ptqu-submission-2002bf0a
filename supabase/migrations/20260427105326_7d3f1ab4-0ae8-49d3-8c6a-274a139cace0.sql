REVOKE ALL ON FUNCTION public.list_course_groups(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_course_groups(uuid) TO authenticated;