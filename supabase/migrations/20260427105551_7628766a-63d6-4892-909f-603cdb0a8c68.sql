DROP POLICY IF EXISTS "Supervisors manage course students for own courses" ON public.course_students;
DROP POLICY IF EXISTS "Supervisors view course students" ON public.course_students;

CREATE POLICY "Supervisors view course students"
ON public.course_students
FOR SELECT
TO authenticated
USING (public.supervises_course(auth.uid(), course_id));