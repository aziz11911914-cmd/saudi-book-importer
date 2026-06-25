
DROP POLICY IF EXISTS "salon media public read" ON storage.objects;
CREATE POLICY "salon media public read" ON storage.objects FOR SELECT
  USING (bucket_id IN ('salon-media','service-media'));

DROP POLICY IF EXISTS "owner uploads salon media" ON storage.objects;
CREATE POLICY "owner uploads salon media" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN ('salon-media','service-media')
    AND EXISTS (SELECT 1 FROM public.shops s WHERE s.manager_id = auth.uid() AND s.id::text = split_part(name,'/',1))
  );

DROP POLICY IF EXISTS "owner updates salon media" ON storage.objects;
CREATE POLICY "owner updates salon media" ON storage.objects FOR UPDATE
  USING (
    bucket_id IN ('salon-media','service-media')
    AND EXISTS (SELECT 1 FROM public.shops s WHERE s.manager_id = auth.uid() AND s.id::text = split_part(name,'/',1))
  );

DROP POLICY IF EXISTS "owner deletes salon media" ON storage.objects;
CREATE POLICY "owner deletes salon media" ON storage.objects FOR DELETE
  USING (
    bucket_id IN ('salon-media','service-media')
    AND EXISTS (SELECT 1 FROM public.shops s WHERE s.manager_id = auth.uid() AND s.id::text = split_part(name,'/',1))
  );

DROP POLICY IF EXISTS "super admin manages all salon media" ON storage.objects;
CREATE POLICY "super admin manages all salon media" ON storage.objects FOR ALL
  USING (bucket_id IN ('salon-media','service-media') AND public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (bucket_id IN ('salon-media','service-media') AND public.has_role(auth.uid(),'super_admin'));
