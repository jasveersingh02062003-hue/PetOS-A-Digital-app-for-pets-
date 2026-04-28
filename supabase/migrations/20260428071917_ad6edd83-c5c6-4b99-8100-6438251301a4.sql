-- ============================================================
-- MISSING PETS
-- ============================================================

CREATE TYPE public.missing_status AS ENUM ('active', 'resolved', 'cancelled');

CREATE TABLE public.missing_pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  photo_url text,
  last_seen_lat numeric,
  last_seen_lng numeric,
  last_seen_city text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  reward_inr integer DEFAULT 0,
  note text,
  status public.missing_status NOT NULL DEFAULT 'active',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_missing_pets_status_city ON public.missing_pets(status, last_seen_city);
CREATE INDEX idx_missing_pets_owner ON public.missing_pets(owner_id);

ALTER TABLE public.missing_pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY missing_select_active ON public.missing_pets
FOR SELECT TO authenticated
USING (status = 'active' OR auth.uid() = owner_id);

CREATE POLICY missing_insert_owner ON public.missing_pets
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = owner_id
  AND EXISTS (SELECT 1 FROM public.pets p WHERE p.id = missing_pets.pet_id AND p.owner_id = auth.uid())
);

CREATE POLICY missing_update_owner ON public.missing_pets
FOR UPDATE TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_missing_pets_updated_at
BEFORE UPDATE ON public.missing_pets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sightings
CREATE TABLE public.missing_pet_sightings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  missing_pet_id uuid NOT NULL REFERENCES public.missing_pets(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  photo_url text,
  lat numeric,
  lng numeric,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sightings_missing ON public.missing_pet_sightings(missing_pet_id, created_at DESC);

ALTER TABLE public.missing_pet_sightings ENABLE ROW LEVEL SECURITY;

CREATE POLICY sightings_select_owner_or_reporter ON public.missing_pet_sightings
FOR SELECT TO authenticated
USING (
  auth.uid() = reporter_id
  OR EXISTS (
    SELECT 1 FROM public.missing_pets mp
    WHERE mp.id = missing_pet_sightings.missing_pet_id AND mp.owner_id = auth.uid()
  )
);

CREATE POLICY sightings_insert_signed_in ON public.missing_pet_sightings
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = reporter_id
  AND EXISTS (
    SELECT 1 FROM public.missing_pets mp
    WHERE mp.id = missing_pet_sightings.missing_pet_id AND mp.status = 'active'
  )
);

-- ============================================================
-- TRIGGERS — notify city neighbors and the owner
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_missing_pet_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet_name text;
  v_species text;
  rec RECORD;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  SELECT name, species::text INTO v_pet_name, v_species FROM public.pets WHERE id = NEW.pet_id;

  FOR rec IN
    SELECT id FROM public.profiles
    WHERE id <> NEW.owner_id
      AND NEW.last_seen_city IS NOT NULL
      AND lower(city) = lower(NEW.last_seen_city)
    LIMIT 5000
  LOOP
    PERFORM public.notify_user(
      rec.id,
      'missing_pet',
      'Help find ' || COALESCE(v_pet_name, 'a pet'),
      COALESCE(v_species, 'pet') || ' last seen in ' || COALESCE(NEW.last_seen_city, 'your area'),
      '/missing/' || NEW.id
    );
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_missing_pet_alerts
AFTER INSERT ON public.missing_pets
FOR EACH ROW EXECUTE FUNCTION public.notify_missing_pet_alerts();

CREATE OR REPLACE FUNCTION public.notify_owner_on_sighting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_pet_name text;
BEGIN
  SELECT mp.owner_id, p.name
    INTO v_owner, v_pet_name
  FROM public.missing_pets mp
  JOIN public.pets p ON p.id = mp.pet_id
  WHERE mp.id = NEW.missing_pet_id;

  IF v_owner IS NOT NULL AND v_owner <> NEW.reporter_id THEN
    PERFORM public.notify_user(
      v_owner,
      'sighting',
      'New sighting of ' || COALESCE(v_pet_name, 'your pet'),
      COALESCE(LEFT(NEW.note, 80), 'Tap to view location and photo.'),
      '/missing/' || NEW.missing_pet_id
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_owner_on_sighting
AFTER INSERT ON public.missing_pet_sightings
FOR EACH ROW EXECUTE FUNCTION public.notify_owner_on_sighting();

-- ============================================================
-- STORAGE — public bucket for missing pet photos
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('missing-pets', 'missing-pets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Missing pet photos are public"
ON storage.objects FOR SELECT TO public, authenticated
USING (bucket_id = 'missing-pets');

CREATE POLICY "Owners can upload missing pet photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'missing-pets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can update their missing pet photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'missing-pets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can delete their missing pet photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'missing-pets' AND auth.uid()::text = (storage.foldername(name))[1]);