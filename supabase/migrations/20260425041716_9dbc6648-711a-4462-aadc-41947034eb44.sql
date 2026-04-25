
-- Allow supervisors to manage course_students rows for their own courses
-- (enroll existing students into their courses, or remove them)
CREATE POLICY "Supervisors manage course students for own courses"
ON public.course_students
FOR ALL
TO public
USING (public.supervises_course(auth.uid(), course_id))
WITH CHECK (public.supervises_course(auth.uid(), course_id));

-- Allow supervisors to create/update/delete groups inside their courses
CREATE POLICY "Supervisors manage groups for own courses"
ON public.groups
FOR ALL
TO public
USING (public.supervises_course(auth.uid(), course_id))
WITH CHECK (public.supervises_course(auth.uid(), course_id));

-- Allow supervisors to manage members of those groups
CREATE POLICY "Supervisors manage group members for own courses"
ON public.group_members
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_members.group_id
      AND public.supervises_course(auth.uid(), g.course_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_members.group_id
      AND public.supervises_course(auth.uid(), g.course_id)
  )
);
