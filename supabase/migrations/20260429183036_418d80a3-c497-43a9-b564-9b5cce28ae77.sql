CREATE TYPE public.sponsorship_status AS ENUM ('pledged', 'active', 'cancelled');

CREATE TABLE public.sponsorships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sponsor_id UUID NOT NULL,
  org_user_id UUID NOT NULL,
  listing_id UUID REFERENCES public.pet_listings(id) ON DELETE SET NULL,
  amount_inr INTEGER NOT NULL CHECK (amount_inr > 0),
  status public.sponsorship_status NOT NULL DEFAULT 'active',
  message TEXT,
  anonymous BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_charge_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sponsorships_org ON public.sponsorships(org_user_id, status, created_at DESC);
CREATE INDEX idx_sponsorships_sponsor ON public.sponsorships(sponsor_id, created_at DESC);
CREATE INDEX idx_sponsorships_listing ON public.sponsorships(listing_id) WHERE listing_id IS NOT NULL;

ALTER TABLE public.sponsorships ENABLE ROW LEVEL SECURITY;

-- Sponsor manages their own
CREATE POLICY "Sponsor reads own"
  ON public.sponsorships FOR SELECT
  USING (auth.uid() = sponsor_id);

CREATE POLICY "Sponsor inserts own"
  ON public.sponsorships FOR INSERT
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY "Sponsor updates own"
  ON public.sponsorships FOR UPDATE
  USING (auth.uid() = sponsor_id);

CREATE POLICY "Sponsor deletes own"
  ON public.sponsorships FOR DELETE
  USING (auth.uid() = sponsor_id);

-- Receiving sanctuary reads all sponsorships made to them
CREATE POLICY "Org reads incoming"
  ON public.sponsorships FOR SELECT
  USING (auth.uid() = org_user_id);

-- Public can read active, non-anonymous sponsorships (for "supporters" counters)
CREATE POLICY "Public reads active non-anonymous"
  ON public.sponsorships FOR SELECT
  USING (status = 'active' AND anonymous = false);

CREATE TRIGGER trg_sponsorships_updated_at
  BEFORE UPDATE ON public.sponsorships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

-- Notify the org on new pledges and on cancellation
CREATE OR REPLACE FUNCTION public.handle_sponsorship_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (
      NEW.org_user_id,
      'sponsorship_new',
      'New monthly sponsor 💛',
      CASE WHEN NEW.anonymous
        THEN 'An anonymous supporter pledged ₹' || NEW.amount_inr || '/month.'
        ELSE 'A new supporter pledged ₹' || NEW.amount_inr || '/month.'
      END,
      '/org/donations'
    );
  ELSIF TG_OP = 'UPDATE'
    AND OLD.status IS DISTINCT FROM NEW.status
    AND NEW.status = 'cancelled' THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (
      NEW.org_user_id,
      'sponsorship_cancelled',
      'A sponsorship was cancelled',
      'Monthly pledge of ₹' || NEW.amount_inr || ' has ended.',
      '/org/donations'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sponsorship_change ON public.sponsorships;
CREATE TRIGGER trg_sponsorship_change
  AFTER INSERT OR UPDATE ON public.sponsorships
  FOR EACH ROW EXECUTE FUNCTION public.handle_sponsorship_change();