
-- Kennel capacity & availability
ALTER TABLE public.boarding_services
  ADD COLUMN IF NOT EXISTS capacity INTEGER,
  ADD COLUMN IF NOT EXISTS next_available_at TIMESTAMPTZ;

-- Sanctuary monthly upkeep
ALTER TABLE public.pet_listings
  ADD COLUMN IF NOT EXISTS monthly_upkeep_inr INTEGER;

-- Wishlists
CREATE TABLE IF NOT EXISTS public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  listing_id UUID NOT NULL REFERENCES public.pet_listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlists_user ON public.wishlists(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishlists_listing ON public.wishlists(listing_id);

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wishlist"
  ON public.wishlists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users add to own wishlist"
  ON public.wishlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users remove from own wishlist"
  ON public.wishlists FOR DELETE
  USING (auth.uid() = user_id);

-- Enforce free adoption for shelters/sanctuaries/rescuers
CREATE OR REPLACE FUNCTION public.enforce_shelter_zero_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_type TEXT;
BEGIN
  SELECT account_type INTO owner_type FROM public.profiles WHERE id = NEW.owner_id;
  IF NEW.seller_type IN ('shelter', 'sanctuary', 'rescuer')
     OR owner_type IN ('shelter', 'sanctuary', 'rescuer') THEN
    IF NEW.fee_inr IS NOT NULL AND NEW.fee_inr > 0 THEN
      RAISE EXCEPTION 'Shelter, sanctuary, and rescuer listings must be free (fee_inr must be 0 or null).';
    END IF;
    NEW.listing_type := 'adoption';
    NEW.fee_inr := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pet_listings_enforce_zero_fee ON public.pet_listings;
CREATE TRIGGER pet_listings_enforce_zero_fee
BEFORE INSERT OR UPDATE OF fee_inr, seller_type, listing_type ON public.pet_listings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_shelter_zero_fee();
