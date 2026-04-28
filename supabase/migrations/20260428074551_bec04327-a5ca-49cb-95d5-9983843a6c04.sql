
-- Payment intents ledger (Beta-free today, real charges once Stripe is configured)
CREATE TYPE public.payment_kind AS ENUM ('vet_consult','mating_listing','agreement','missing_listing');
CREATE TYPE public.payment_intent_status AS ENUM ('beta_free','pending','paid','failed','refunded');

CREATE TABLE public.payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind public.payment_kind NOT NULL,
  amount_inr INTEGER NOT NULL,
  status public.payment_intent_status NOT NULL DEFAULT 'beta_free',
  provider_session_id TEXT,
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intents_select_own" ON public.payment_intents
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "intents_insert_own" ON public.payment_intents
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER payment_intents_updated_at
BEFORE UPDATE ON public.payment_intents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_payment_intents_user ON public.payment_intents(user_id, created_at DESC);

-- Reminder log to dedupe vaccination booster nudges
CREATE TABLE public.reminder_log (
  vaccination_id UUID NOT NULL,
  kind TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (vaccination_id, kind)
);

ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;
-- No public policies; only service role writes via edge function.

-- Realtime for sightings
ALTER TABLE public.missing_pet_sightings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.missing_pet_sightings;

-- Enable scheduling extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
