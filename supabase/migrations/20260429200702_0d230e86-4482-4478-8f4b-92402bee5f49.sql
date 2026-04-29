
ALTER TABLE public.pet_listings
  ADD COLUMN IF NOT EXISTS co_listed_with_org_id uuid REFERENCES public.org_profiles(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pet_listings_colisted ON public.pet_listings(co_listed_with_org_id);

CREATE OR REPLACE FUNCTION public.enforce_rescuer_colist()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  author_role text;
  author_org_status text;
  shelter_status text;
  shelter_type text;
BEGIN
  SELECT account_type INTO author_role FROM public.profiles WHERE id = NEW.owner_id;
  IF author_role IS DISTINCT FROM 'rescuer' THEN
    RETURN NEW;
  END IF;

  SELECT status INTO author_org_status
    FROM public.org_profiles WHERE user_id = NEW.owner_id;
  IF author_org_status = 'approved' THEN
    RETURN NEW;
  END IF;

  IF NEW.co_listed_with_org_id IS NULL THEN
    RAISE EXCEPTION 'Unverified rescuers must co-list with an approved shelter.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT status, org_type::text INTO shelter_status, shelter_type
    FROM public.org_profiles WHERE user_id = NEW.co_listed_with_org_id;
  IF shelter_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Co-listing org must be an approved shelter.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_rescuer_colist ON public.pet_listings;
CREATE TRIGGER trg_enforce_rescuer_colist
  BEFORE INSERT ON public.pet_listings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_rescuer_colist();
