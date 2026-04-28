-- 1. New enum
DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('pet_parent','breeder','kennel','shelter','sanctuary','zoo','rescuer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. profiles additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type public.account_type NOT NULL DEFAULT 'pet_parent';

-- 3. org_profiles
CREATE TABLE IF NOT EXISTS public.org_profiles (
  user_id uuid PRIMARY KEY,
  org_name text NOT NULL,
  org_type public.account_type NOT NULL,
  registration_no text,
  registration_doc_url text,
  address text,
  city text,
  state text,
  pincode text,
  lat numeric,
  lng numeric,
  phone text,
  website text,
  description text,
  facility_photos text[] NOT NULL DEFAULT '{}',
  donation_upi text,
  donation_url text,
  status text NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_profiles_owner_all ON public.org_profiles;
CREATE POLICY org_profiles_owner_all ON public.org_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS org_profiles_select_approved ON public.org_profiles;
CREATE POLICY org_profiles_select_approved ON public.org_profiles
  FOR SELECT TO authenticated
  USING (status = 'approved' OR user_id = auth.uid()
         OR public.has_role(auth.uid(),'super_admin')
         OR public.has_role(auth.uid(),'moderator'));

DROP POLICY IF EXISTS org_profiles_admin_update ON public.org_profiles;
CREATE POLICY org_profiles_admin_update ON public.org_profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator'));

CREATE TRIGGER tg_org_profiles_updated
  BEFORE UPDATE ON public.org_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. litter_groups
CREATE TABLE IF NOT EXISTS public.litter_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sire_pet_id uuid,
  dam_pet_id uuid,
  birth_date date,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.litter_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS litter_select_all ON public.litter_groups;
CREATE POLICY litter_select_all ON public.litter_groups FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS litter_insert_own ON public.litter_groups;
CREATE POLICY litter_insert_own ON public.litter_groups FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS litter_update_own ON public.litter_groups;
CREATE POLICY litter_update_own ON public.litter_groups FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS litter_delete_own ON public.litter_groups;
CREATE POLICY litter_delete_own ON public.litter_groups FOR DELETE TO authenticated USING (created_by = auth.uid());

-- 5. pets lineage columns
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS sire_pet_id uuid,
  ADD COLUMN IF NOT EXISTS dam_pet_id uuid,
  ADD COLUMN IF NOT EXISTS litter_id uuid REFERENCES public.litter_groups(id) ON DELETE SET NULL;

-- 6. pet_listings additions
ALTER TABLE public.pet_listings
  ADD COLUMN IF NOT EXISTS litter_id uuid REFERENCES public.litter_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bred_on_petos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_type public.account_type;

-- 7. Listing seller-type snapshot + compliance trigger
CREATE OR REPLACE FUNCTION public.tg_listing_compliance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_type public.account_type;
DECLARE v_sire uuid; v_dam uuid;
BEGIN
  SELECT account_type INTO v_type FROM public.profiles WHERE id = NEW.owner_id;
  NEW.seller_type := COALESCE(v_type, 'pet_parent');

  IF NEW.seller_type = 'zoo' THEN
    RAISE EXCEPTION 'Zoos cannot create pet listings';
  END IF;

  IF NEW.seller_type IN ('shelter','sanctuary','rescuer') THEN
    NEW.listing_type := 'adoption';
    NEW.fee_inr := 0;
  END IF;

  -- Bred on PetOS
  IF NEW.litter_id IS NOT NULL THEN
    SELECT sire_pet_id, dam_pet_id INTO v_sire, v_dam FROM public.litter_groups WHERE id = NEW.litter_id;
    IF v_sire IS NOT NULL AND v_dam IS NOT NULL THEN
      NEW.bred_on_petos := true;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_pet_listings_compliance ON public.pet_listings;
CREATE TRIGGER tg_pet_listings_compliance
  BEFORE INSERT OR UPDATE ON public.pet_listings
  FOR EACH ROW EXECUTE FUNCTION public.tg_listing_compliance();

-- 8. Org approval -> verify breeder
CREATE OR REPLACE FUNCTION public.tg_org_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    NEW.reviewed_at := now();
    IF NEW.org_type IN ('breeder','kennel') THEN
      UPDATE public.profiles SET breeder_verified = true WHERE id = NEW.user_id;
    END IF;
    UPDATE public.profiles SET account_type = NEW.org_type WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_org_profiles_approval ON public.org_profiles;
CREATE TRIGGER tg_org_profiles_approval
  BEFORE UPDATE ON public.org_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_org_approval();

-- 9. Storage bucket org-docs
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-docs','org-docs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "org-docs public read" ON storage.objects;
CREATE POLICY "org-docs public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'org-docs');

DROP POLICY IF EXISTS "org-docs owner upload" ON storage.objects;
CREATE POLICY "org-docs owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "org-docs owner update" ON storage.objects;
CREATE POLICY "org-docs owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'org-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "org-docs owner delete" ON storage.objects;
CREATE POLICY "org-docs owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'org-docs' AND auth.uid()::text = (storage.foldername(name))[1]);