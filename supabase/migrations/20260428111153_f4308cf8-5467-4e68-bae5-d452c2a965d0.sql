-- Wave 7

-- 1) walk_tracks
CREATE TABLE IF NOT EXISTS public.walk_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_walk_tracks_booking_time ON public.walk_tracks (booking_id, recorded_at);
ALTER TABLE public.walk_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS walk_tracks_select_party ON public.walk_tracks;
CREATE POLICY walk_tracks_select_party ON public.walk_tracks FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.service_bookings sb
    LEFT JOIN public.service_providers sp ON sp.id = sb.provider_id
    WHERE sb.id = walk_tracks.booking_id
      AND (sb.customer_id = auth.uid() OR sp.owner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS walk_tracks_insert_provider ON public.walk_tracks;
CREATE POLICY walk_tracks_insert_provider ON public.walk_tracks FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.service_bookings sb
    JOIN public.service_providers sp ON sp.id = sb.provider_id
    WHERE sb.id = walk_tracks.booking_id
      AND sp.owner_id = auth.uid()
  )
);

-- 2) medication_logs vet linkage
ALTER TABLE public.medication_logs ADD COLUMN IF NOT EXISTS appointment_id uuid;
ALTER TABLE public.medication_logs ADD COLUMN IF NOT EXISTS prescribed_by_vet_id uuid;

-- 3) pharmacy_suggestions
CREATE TABLE IF NOT EXISTS public.pharmacy_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  pet_id uuid NOT NULL,
  vet_id uuid NOT NULL,
  appointment_id uuid,
  medication_log_id uuid,
  med_name text NOT NULL,
  dose text,
  frequency text,
  duration text,
  notes text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pharmacy_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pharm_select_party ON public.pharmacy_suggestions;
CREATE POLICY pharm_select_party ON public.pharmacy_suggestions FOR SELECT TO authenticated USING (
  owner_id = auth.uid() OR vet_id = auth.uid()
);
DROP POLICY IF EXISTS pharm_insert_vet ON public.pharmacy_suggestions;
CREATE POLICY pharm_insert_vet ON public.pharmacy_suggestions FOR INSERT TO authenticated WITH CHECK (
  vet_id = auth.uid()
);
DROP POLICY IF EXISTS pharm_update_owner ON public.pharmacy_suggestions;
CREATE POLICY pharm_update_owner ON public.pharmacy_suggestions FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 4) shop_products tags
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shop_products') THEN
    EXECUTE 'ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ''{}''::text[]';
  END IF;
END $$;