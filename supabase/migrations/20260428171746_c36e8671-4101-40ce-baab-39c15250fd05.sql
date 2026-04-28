CREATE TYPE public.pet_listing_type AS ENUM ('adoption', 'rehoming', 'breeder_sale');
CREATE TYPE public.pet_listing_status AS ENUM ('active', 'pending_review', 'taken_down', 'completed');

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS breeder_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS breeder_cert_url text;

CREATE TABLE public.pet_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  listing_type public.pet_listing_type NOT NULL,
  fee_inr integer,
  city text,
  lat numeric,
  lng numeric,
  age_weeks integer NOT NULL,
  species text,
  breed text,
  gender text,
  vaccination_doc_url text NOT NULL,
  breeder_cert_url text,
  parents_info jsonb,
  microchip_id text,
  title text NOT NULL,
  description text,
  photos text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  status public.pet_listing_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pet_listings_age_min CHECK (age_weeks >= 8),
  CONSTRAINT pet_listings_fee_nonneg CHECK (fee_inr IS NULL OR fee_inr >= 0)
);

CREATE INDEX idx_pet_listings_active ON public.pet_listings (active, status, created_at DESC);
CREATE INDEX idx_pet_listings_type ON public.pet_listings (listing_type);
CREATE INDEX idx_pet_listings_owner ON public.pet_listings (owner_id);
CREATE INDEX idx_pet_listings_city ON public.pet_listings (city);

CREATE OR REPLACE FUNCTION public.tg_pet_listings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pet_listings_updated
BEFORE UPDATE ON public.pet_listings
FOR EACH ROW EXECUTE FUNCTION public.tg_pet_listings_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_breeder_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.listing_type = 'breeder_sale' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = NEW.owner_id AND p.breeder_verified = true
    ) THEN
      RAISE EXCEPTION 'Only verified breeders can create breeder_sale listings';
    END IF;
  END IF;
  IF NEW.listing_type = 'adoption' AND NEW.fee_inr IS NOT NULL AND NEW.fee_inr > 0 THEN
    RAISE EXCEPTION 'Adoption listings must be free';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pet_listings_enforce_breeder
BEFORE INSERT OR UPDATE ON public.pet_listings
FOR EACH ROW EXECUTE FUNCTION public.enforce_breeder_verified();

ALTER TABLE public.pet_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY pet_listings_select_active
ON public.pet_listings
FOR SELECT
TO authenticated
USING ((active = true AND status = 'active') OR owner_id = auth.uid());

CREATE POLICY pet_listings_insert_own
ON public.pet_listings
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY pet_listings_update_own
ON public.pet_listings
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY pet_listings_delete_own
ON public.pet_listings
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('pet-listings', 'pet-listings', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "pet-listings public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'pet-listings');

CREATE POLICY "pet-listings user insert own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pet-listings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "pet-listings user update own folder"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'pet-listings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "pet-listings user delete own folder"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pet-listings' AND auth.uid()::text = (storage.foldername(name))[1]);