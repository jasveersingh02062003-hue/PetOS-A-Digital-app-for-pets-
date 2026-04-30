-- Phase 5 follow-up: kill the last two cross-public policies on storage.objects
DROP POLICY IF EXISTS "Stories publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "pet-listings public read"  ON storage.objects;

-- Re-add as authenticated-only listing (per-bucket, in line with Phase 5)
DROP POLICY IF EXISTS "auth_can_list_stories"      ON storage.objects;
CREATE POLICY "auth_can_list_stories" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'stories');

DROP POLICY IF EXISTS "auth_can_list_pet-listings" ON storage.objects;
CREATE POLICY "auth_can_list_pet-listings" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'pet-listings');
