CREATE TYPE public.mating_intent AS ENUM ('stud','dam','either');
CREATE TYPE public.request_status AS ENUM ('pending','accepted','declined','withdrawn','agreed');

CREATE TABLE public.mating_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  intent public.mating_intent NOT NULL DEFAULT 'either',
  fee_inr INTEGER,
  city TEXT,
  travel_km INTEGER DEFAULT 0,
  description TEXT,
  requirements TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pet_id)
);
CREATE INDEX idx_listings_active ON public.mating_listings(active, created_at DESC);
CREATE INDEX idx_listings_city ON public.mating_listings(city);

ALTER TABLE public.mating_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listings_select_all" ON public.mating_listings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "listings_owner_insert" ON public.mating_listings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "listings_owner_update" ON public.mating_listings
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "listings_owner_delete" ON public.mating_listings
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER trg_listings_updated BEFORE UPDATE ON public.mating_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enforce verified + discoverable on listing
CREATE OR REPLACE FUNCTION public.check_pet_eligible_for_mating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ok BOOLEAN;
BEGIN
  SELECT (vaccination_verified AND discoverable_for_mating) INTO v_ok
  FROM public.pets WHERE id = NEW.pet_id;
  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'Pet must be vaccination-verified and marked discoverable for mating.';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.check_pet_eligible_for_mating() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_check_listing_eligible BEFORE INSERT ON public.mating_listings
  FOR EACH ROW EXECUTE FUNCTION public.check_pet_eligible_for_mating();

-- Requests
CREATE TABLE public.mating_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  to_pet_id   UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  from_owner_id UUID NOT NULL,
  to_owner_id   UUID NOT NULL,
  message TEXT,
  status public.request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_pet_id, to_pet_id)
);
CREATE INDEX idx_requests_to ON public.mating_requests(to_owner_id, status);
CREATE INDEX idx_requests_from ON public.mating_requests(from_owner_id, status);

ALTER TABLE public.mating_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requests_select_party" ON public.mating_requests
  FOR SELECT TO authenticated USING (auth.uid() = from_owner_id OR auth.uid() = to_owner_id);
CREATE POLICY "requests_from_insert" ON public.mating_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_owner_id);
CREATE POLICY "requests_party_update" ON public.mating_requests
  FOR UPDATE TO authenticated USING (auth.uid() = from_owner_id OR auth.uid() = to_owner_id)
  WITH CHECK (auth.uid() = from_owner_id OR auth.uid() = to_owner_id);

CREATE TRIGGER trg_requests_updated BEFORE UPDATE ON public.mating_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Agreements
CREATE TABLE public.mating_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES public.mating_requests(id) ON DELETE CASCADE,
  terms_text TEXT NOT NULL,
  from_signature TEXT,
  from_signed_at TIMESTAMPTZ,
  to_signature TEXT,
  to_signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mating_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agreements_select_party" ON public.mating_agreements
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.mating_requests r
            WHERE r.id = mating_agreements.request_id
              AND (auth.uid() = r.from_owner_id OR auth.uid() = r.to_owner_id))
  );
CREATE POLICY "agreements_party_insert" ON public.mating_agreements
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.mating_requests r
            WHERE r.id = mating_agreements.request_id
              AND (auth.uid() = r.from_owner_id OR auth.uid() = r.to_owner_id))
  );
CREATE POLICY "agreements_party_update" ON public.mating_agreements
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.mating_requests r
            WHERE r.id = mating_agreements.request_id
              AND (auth.uid() = r.from_owner_id OR auth.uid() = r.to_owner_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.mating_requests r
            WHERE r.id = mating_agreements.request_id
              AND (auth.uid() = r.from_owner_id OR auth.uid() = r.to_owner_id))
  );
CREATE TRIGGER trg_agreements_updated BEFORE UPDATE ON public.mating_agreements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- When both sigs present, flip request to 'agreed'
CREATE OR REPLACE FUNCTION public.maybe_finalize_agreement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.from_signature IS NOT NULL AND NEW.to_signature IS NOT NULL THEN
    UPDATE public.mating_requests SET status = 'agreed' WHERE id = NEW.request_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.maybe_finalize_agreement() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_finalize_agreement AFTER INSERT OR UPDATE ON public.mating_agreements
  FOR EACH ROW EXECUTE FUNCTION public.maybe_finalize_agreement();

ALTER PUBLICATION supabase_realtime ADD TABLE public.mating_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mating_agreements;