
DO $$ BEGIN
  CREATE TYPE public.donation_status AS ENUM ('pending','paid','refunded','beta_free');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL,
  org_user_id uuid NOT NULL,
  amount_inr integer NOT NULL CHECK (amount_inr >= 10),
  message text,
  anonymous boolean NOT NULL DEFAULT false,
  status public.donation_status NOT NULL DEFAULT 'pending',
  payment_intent_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_donations_org ON public.donations(org_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_donor ON public.donations(donor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_status ON public.donations(status);

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Donors can view own donations"
  ON public.donations FOR SELECT
  USING (auth.uid() = donor_id);

CREATE POLICY "Org owners can view donations to them"
  ON public.donations FOR SELECT
  USING (auth.uid() = org_user_id);

CREATE POLICY "Donors can create their own donations"
  ON public.donations FOR INSERT
  WITH CHECK (auth.uid() = donor_id AND donor_id <> org_user_id);

-- Updates only happen via webhook (service role bypasses RLS); no policy required.

ALTER TABLE public.org_profiles
  ADD COLUMN IF NOT EXISTS total_donations_inr integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS donor_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.tg_donation_bump_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status = 'paid' AND OLD.status <> 'paid')
     OR (TG_OP = 'INSERT' AND NEW.status IN ('paid','beta_free')) THEN
    UPDATE public.org_profiles
       SET total_donations_inr = total_donations_inr + NEW.amount_inr,
           donor_count = donor_count + 1
     WHERE user_id = NEW.org_user_id;
    IF NEW.paid_at IS NULL THEN
      NEW.paid_at := now();
    END IF;
    PERFORM public.notify_user(
      NEW.org_user_id,
      'donation_received',
      'New donation received',
      '₹' || NEW.amount_inr::text || COALESCE(' — "' || left(NEW.message, 60) || '"', ''),
      '/org/donations'
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_donations_bump ON public.donations;
CREATE TRIGGER tg_donations_bump
  BEFORE INSERT OR UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.tg_donation_bump_totals();
