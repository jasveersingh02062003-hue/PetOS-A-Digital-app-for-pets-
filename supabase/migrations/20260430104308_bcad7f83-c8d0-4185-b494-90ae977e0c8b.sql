ALTER TABLE public.insurance_leads
  ADD COLUMN IF NOT EXISTS policy_number text,
  ADD COLUMN IF NOT EXISTS expires_on date;

DO $$ BEGIN
  CREATE TYPE public.insurance_claim_status AS ENUM ('submitted','under_review','approved','paid','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.insurance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  lead_id uuid REFERENCES public.insurance_leads(id) ON DELETE SET NULL,
  claim_ref text,
  amount_inr numeric NOT NULL,
  description text,
  status public.insurance_claim_status NOT NULL DEFAULT 'submitted',
  photo_paths text[],
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_pet ON public.insurance_claims(pet_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ic_owner ON public.insurance_claims(owner_id);

ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own claims"
ON public.insurance_claims FOR ALL
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Admins read all claims"
ON public.insurance_claims FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins update claims"
ON public.insurance_claims FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_ic_updated
BEFORE UPDATE ON public.insurance_claims
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();