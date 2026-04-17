
-- Replace the DELETE policy: require an owned submission row, not just folder name
DROP POLICY IF EXISTS "Students delete own submission files" ON storage.objects;
CREATE POLICY "Students delete own submission files"
  ON storage.objects
  FOR DELETE
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

-- Explicit UPDATE policy: only admins may overwrite/replace files in the submissions bucket
DROP POLICY IF EXISTS "Admins update submission files" ON storage.objects;
CREATE POLICY "Admins update submission files"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'submissions' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'submissions' AND public.is_admin(auth.uid()));
