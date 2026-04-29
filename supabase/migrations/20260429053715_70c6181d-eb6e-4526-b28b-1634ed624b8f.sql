INSERT INTO storage.buckets (id, name, public)
VALUES ('agreements', 'agreements', false)
ON CONFLICT (id) DO NOTHING;

-- Owners (either party of the mating request) can read their PDF
DROP POLICY IF EXISTS "agreements: parties can read" ON storage.objects;
CREATE POLICY "agreements: parties can read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'agreements'
  AND EXISTS (
    SELECT 1 FROM public.mating_agreements ma
    JOIN public.mating_requests mr ON mr.id = ma.request_id
    WHERE ma.id::text = split_part(name, '/', 1)
      AND (mr.from_owner_id = auth.uid() OR mr.to_owner_id = auth.uid())
  )
);

-- Only service role inserts (via edge function) — no client write policy needed