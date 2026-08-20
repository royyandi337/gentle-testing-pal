CREATE POLICY "rds_storage_select_own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('photos-original','photos-processed','documents-original','documents-processed','exports','thumbnails')
  AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "rds_storage_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('photos-original','photos-processed','documents-original','documents-processed','exports','thumbnails')
  AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "rds_storage_update_own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('photos-original','photos-processed','documents-original','documents-processed','exports','thumbnails')
  AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id IN ('photos-original','photos-processed','documents-original','documents-processed','exports','thumbnails')
  AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "rds_storage_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('photos-original','photos-processed','documents-original','documents-processed','exports','thumbnails')
  AND (storage.foldername(name))[1] = auth.uid()::text);