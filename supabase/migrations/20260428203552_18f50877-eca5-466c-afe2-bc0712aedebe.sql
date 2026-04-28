
-- Status enum
DO $$ BEGIN
  CREATE TYPE public.insurance_lead_status AS ENUM ('new','contacted','quoted','purchased','lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Partners catalog
CREATE TABLE IF NOT EXISTS public.insurance_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  blurb text,
  country text NOT NULL DEFAULT 'IN',
  plan_min_inr integer,
  plan_max_inr integer,
  redirect_url text NOT NULL,
  commission_pct numeric(5,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.insurance_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active partners"
  ON public.insurance_partners FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Admins manage partners"
  ON public.insurance_partners FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE TRIGGER tg_insurance_partners_updated
  BEFORE UPDATE ON public.insurance_partners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Leads
CREATE TABLE IF NOT EXISTS public.insurance_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.insurance_partners(id) ON DELETE RESTRICT,
  status public.insurance_lead_status NOT NULL DEFAULT 'new',
  pet_breed_snapshot text,
  pet_age_months_snapshot integer,
  premium_inr integer,
  commission_inr integer,
  partner_ref text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_leads_user ON public.insurance_leads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insurance_leads_status ON public.insurance_leads(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_insurance_leads_partner_ref ON public.insurance_leads(partner_id, partner_ref) WHERE partner_ref IS NOT NULL;

ALTER TABLE public.insurance_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own leads"
  ON public.insurance_leads FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Owner inserts own leads"
  ON public.insurance_leads FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.pets WHERE id = pet_id AND owner_id = auth.uid())
  );

CREATE POLICY "Admins update leads"
  ON public.insurance_leads FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'));

-- No DELETE policy = no deletes

CREATE TRIGGER tg_insurance_leads_updated
  BEFORE UPDATE ON public.insurance_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Snapshot breed + age at insert
CREATE OR REPLACE FUNCTION public.tg_snapshot_insurance_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_breed text; v_dob date;
BEGIN
  SELECT breed, date_of_birth INTO v_breed, v_dob FROM public.pets WHERE id = NEW.pet_id;
  IF NEW.pet_breed_snapshot IS NULL THEN NEW.pet_breed_snapshot := v_breed; END IF;
  IF NEW.pet_age_months_snapshot IS NULL AND v_dob IS NOT NULL THEN
    NEW.pet_age_months_snapshot := GREATEST(0, ((EXTRACT(YEAR FROM age(v_dob)) * 12) + EXTRACT(MONTH FROM age(v_dob)))::int);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_insurance_lead_snapshot
  BEFORE INSERT ON public.insurance_leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_snapshot_insurance_lead();

-- Auto-compute commission when marked purchased
CREATE OR REPLACE FUNCTION public.tg_compute_insurance_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pct numeric;
BEGIN
  IF NEW.status = 'purchased' AND NEW.premium_inr IS NOT NULL
     AND (NEW.commission_inr IS NULL OR NEW.commission_inr = 0) THEN
    SELECT commission_pct INTO v_pct FROM public.insurance_partners WHERE id = NEW.partner_id;
    IF v_pct IS NOT NULL THEN
      NEW.commission_inr := ROUND(NEW.premium_inr * v_pct / 100.0)::int;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_insurance_lead_commission
  BEFORE INSERT OR UPDATE ON public.insurance_leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_compute_insurance_commission();

-- Seed two inactive demo partners
INSERT INTO public.insurance_partners (name, blurb, country, plan_min_inr, plan_max_inr, redirect_url, commission_pct, active, sort_order)
VALUES
  ('Bajaj Allianz Pet', 'Comprehensive pet health insurance with OPD and surgery cover.', 'IN', 4000, 18000, 'https://example.com/bajaj-pet?lead={lead_id}', 8.00, false, 10),
  ('Digit Pet Care', 'Affordable plans with vaccination top-ups and accident cover.', 'IN', 2500, 12000, 'https://example.com/digit-pet?lead={lead_id}', 10.00, false, 20)
ON CONFLICT DO NOTHING;
