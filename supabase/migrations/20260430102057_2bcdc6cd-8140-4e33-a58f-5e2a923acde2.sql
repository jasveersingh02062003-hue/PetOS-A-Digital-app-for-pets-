ALTER TABLE public.symptom_logs ADD COLUMN IF NOT EXISTS photo_paths text[];
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS photo_paths text[];

INSERT INTO storage.buckets (id, name, public)
VALUES ('health-media', 'health-media', false)
ON CONFLICT (id) DO NOTHING;

-- Owner: full access to files under {auth.uid()}/...
CREATE POLICY "health_media_owner_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'health-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "health_media_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'health-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "health_media_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'health-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "health_media_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'health-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Care-team vets: read-only on photos belonging to owners of pets they're on the care team for.
CREATE POLICY "health_media_care_team_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'health-media'
    AND EXISTS (
      SELECT 1 FROM public.pet_care_team t
      JOIN public.pets p ON p.id = t.pet_id
      WHERE t.vet_id = auth.uid()
        AND p.owner_id::text = (storage.foldername(name))[1]
    )
  );