-- Set search_path on set_updated_at (was missing)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Revoke broad EXECUTE on has_role (still callable in RLS via SECURITY DEFINER context)
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
-- handle_new_user is trigger-only; revoke
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Replace public-listing storage policies with path-scoped ones.
-- Anyone can read individual files (objects served via public URL), but listing requires owner match.
DROP POLICY IF EXISTS "public_read_pet_avatars" ON storage.objects;
DROP POLICY IF EXISTS "public_read_user_avatars" ON storage.objects;
DROP POLICY IF EXISTS "public_read_posts" ON storage.objects;

-- Public read but only when path is referenced (file-by-file). For PostgREST listing, owners-only.
CREATE POLICY "owner_list_pet_avatars" ON storage.objects FOR SELECT
  USING (bucket_id = 'pet-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "owner_list_user_avatars" ON storage.objects FOR SELECT
  USING (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "owner_list_posts" ON storage.objects FOR SELECT
  USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);
-- Note: buckets remain public so getPublicUrl works for displaying images by direct URL.