INSERT INTO storage.buckets (id, name, public)
VALUES ('marketplace', 'marketplace', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "marketplace_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'marketplace');

CREATE POLICY "marketplace_user_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marketplace' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "marketplace_user_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'marketplace' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "marketplace_user_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'marketplace' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_pets_name_trgm ON public.pets USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pets_breed_trgm ON public.pets USING GIN (breed gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_providers_name_trgm ON public.service_providers USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_title_trgm ON public.shop_products USING GIN (title gin_trgm_ops);