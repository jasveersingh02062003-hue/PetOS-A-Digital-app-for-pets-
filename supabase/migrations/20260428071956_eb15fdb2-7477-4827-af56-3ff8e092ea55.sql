-- Subscription tier
CREATE TYPE public.sub_tier AS ENUM ('free', 'plus');
CREATE TYPE public.sub_status AS ENUM ('active', 'past_due', 'canceled', 'trialing');

CREATE TABLE public.subscriptions (
  user_id uuid PRIMARY KEY,
  tier public.sub_tier NOT NULL DEFAULT 'free',
  status public.sub_status NOT NULL DEFAULT 'active',
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subs_select_own ON public.subscriptions
FOR SELECT TO authenticated
USING (auth.uid() = user_id);
-- INSERT/UPDATE only via service role from the Stripe webhook; no client policy.

CREATE TRIGGER trg_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Usage counters (server-side rate limiting)
CREATE TABLE public.usage_counters (
  user_id uuid NOT NULL,
  kind text NOT NULL,           -- e.g. 'ai_chat', 'vet_consult'
  period date NOT NULL,         -- daily granularity
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, kind, period)
);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_select_own ON public.usage_counters
FOR SELECT TO authenticated
USING (auth.uid() = user_id);
-- Writes only via service role.

-- current_tier helper
CREATE OR REPLACE FUNCTION public.current_tier(_user_id uuid)
RETURNS public.sub_tier
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN s.tier = 'plus'
      AND s.status IN ('active','trialing')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
    THEN 'plus'::public.sub_tier
    ELSE 'free'::public.sub_tier
  END
  FROM (SELECT 1) x
  LEFT JOIN public.subscriptions s ON s.user_id = _user_id
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.current_tier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tier(uuid) TO authenticated;

-- Free-tier limit: 1 active missing-pet listing
CREATE OR REPLACE FUNCTION public.enforce_missing_free_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_active_count int; v_tier public.sub_tier;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  v_tier := public.current_tier(NEW.owner_id);
  IF v_tier = 'plus' THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_active_count
  FROM public.missing_pets
  WHERE owner_id = NEW.owner_id AND status = 'active' AND id <> NEW.id;
  IF v_active_count >= 1 THEN
    RAISE EXCEPTION 'Free plan is limited to 1 active missing-pet listing. Upgrade to Plus for unlimited.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_enforce_missing_free_limit
BEFORE INSERT OR UPDATE OF status ON public.missing_pets
FOR EACH ROW EXECUTE FUNCTION public.enforce_missing_free_limit();