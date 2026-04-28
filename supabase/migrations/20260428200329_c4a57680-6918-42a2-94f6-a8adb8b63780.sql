-- ============= Phase 5: Rewards Escrow =============

-- Enums
DO $$ BEGIN
  CREATE TYPE public.reward_status AS ENUM ('pending','available','redeemed','expired','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reward_kind AS ENUM ('earn','release','redeem','expire','adjust');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.redemption_kind AS ENUM ('booking_discount','listing_boost','plus_credit','cash_out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.redemption_status AS ENUM ('requested','approved','applied','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Accounts
CREATE TABLE IF NOT EXISTS public.reward_accounts (
  user_id uuid PRIMARY KEY,
  available_points integer NOT NULL DEFAULT 0,
  pending_points integer NOT NULL DEFAULT 0,
  lifetime_earned integer NOT NULL DEFAULT 0,
  lifetime_redeemed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reward_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own reward account" ON public.reward_accounts
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER tg_reward_accounts_updated
  BEFORE UPDATE ON public.reward_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ledger
CREATE TABLE IF NOT EXISTS public.reward_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind public.reward_kind NOT NULL,
  points integer NOT NULL,
  reason text NOT NULL,
  reference_type text,
  reference_id uuid,
  status public.reward_status NOT NULL DEFAULT 'pending',
  release_after timestamptz,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reward_ledger_user ON public.reward_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_ledger_pending ON public.reward_ledger(status, release_after) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_ledger_ref
  ON public.reward_ledger(user_id, reference_type, reference_id, kind)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL AND kind = 'earn';

ALTER TABLE public.reward_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ledger" ON public.reward_ledger
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins insert ledger" ON public.reward_ledger
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Redemptions
CREATE TABLE IF NOT EXISTS public.reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind public.redemption_kind NOT NULL,
  points_spent integer NOT NULL CHECK (points_spent > 0),
  inr_value integer NOT NULL DEFAULT 0,
  status public.redemption_status NOT NULL DEFAULT 'requested',
  applied_to_reference_type text,
  applied_to_reference_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own redemptions" ON public.reward_redemptions
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users create own redemptions" ON public.reward_redemptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update redemptions" ON public.reward_redemptions
  FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER tg_reward_redemptions_updated
  BEFORE UPDATE ON public.reward_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Rules (configurable point amounts)
CREATE TABLE IF NOT EXISTS public.reward_rules (
  kind text PRIMARY KEY,
  points integer NOT NULL,
  escrow_days integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reward_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads rules" ON public.reward_rules FOR SELECT USING (true);
CREATE POLICY "Admins manage rules" ON public.reward_rules
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER tg_reward_rules_updated
  BEFORE UPDATE ON public.reward_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default rules
INSERT INTO public.reward_rules (kind, points, escrow_days, description) VALUES
  ('booking_completed', 50, 7, 'Completed service booking'),
  ('mating_agreement_signed', 200, 14, 'Signed mating agreement'),
  ('streak_7', 100, 0, '7-day daily streak'),
  ('streak_30', 500, 0, '30-day daily streak'),
  ('helpful_vet_answer', 20, 0, 'Helpful vet answer'),
  ('referral_signup', 300, 30, 'Referred a new user who signed up'),
  ('first_pet_added', 50, 0, 'Added first pet'),
  ('vaccination_verified', 100, 0, 'Pet vaccination verified')
ON CONFLICT (kind) DO NOTHING;

-- ============= Account totals trigger =============
CREATE OR REPLACE FUNCTION public.tg_reward_ledger_apply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure account row exists
  INSERT INTO public.reward_accounts(user_id) VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  IF NEW.kind = 'earn' THEN
    IF NEW.status = 'pending' THEN
      UPDATE public.reward_accounts
        SET pending_points = pending_points + NEW.points,
            lifetime_earned = lifetime_earned + GREATEST(NEW.points, 0)
        WHERE user_id = NEW.user_id;
    ELSIF NEW.status = 'available' THEN
      UPDATE public.reward_accounts
        SET available_points = available_points + NEW.points,
            lifetime_earned = lifetime_earned + GREATEST(NEW.points, 0)
        WHERE user_id = NEW.user_id;
    END IF;
  ELSIF NEW.kind = 'release' THEN
    UPDATE public.reward_accounts
      SET pending_points = GREATEST(pending_points - NEW.points, 0),
          available_points = available_points + NEW.points
      WHERE user_id = NEW.user_id;
  ELSIF NEW.kind = 'redeem' THEN
    UPDATE public.reward_accounts
      SET available_points = GREATEST(available_points - NEW.points, 0),
          lifetime_redeemed = lifetime_redeemed + NEW.points
      WHERE user_id = NEW.user_id;
  ELSIF NEW.kind = 'expire' THEN
    UPDATE public.reward_accounts
      SET pending_points = GREATEST(pending_points - NEW.points, 0)
      WHERE user_id = NEW.user_id;
  ELSIF NEW.kind = 'adjust' THEN
    UPDATE public.reward_accounts
      SET available_points = GREATEST(available_points + NEW.points, 0)
      WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_reward_ledger_apply
  AFTER INSERT ON public.reward_ledger
  FOR EACH ROW EXECUTE FUNCTION public.tg_reward_ledger_apply();

-- ============= Award helper =============
CREATE OR REPLACE FUNCTION public.award_reward(
  _user_id uuid,
  _rule_kind text,
  _reference_type text DEFAULT NULL,
  _reference_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule record;
  v_status public.reward_status;
  v_release_after timestamptz;
  v_id uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_rule FROM public.reward_rules WHERE kind = _rule_kind AND active = true;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_rule.escrow_days > 0 THEN
    v_status := 'pending';
    v_release_after := now() + make_interval(days => v_rule.escrow_days);
  ELSE
    v_status := 'available';
    v_release_after := NULL;
  END IF;

  -- Idempotent on (user, ref, earn) via unique index
  BEGIN
    INSERT INTO public.reward_ledger(user_id, kind, points, reason, reference_type, reference_id, status, release_after)
    VALUES (_user_id, 'earn', v_rule.points, COALESCE(_reason, v_rule.description), _reference_type, _reference_id, v_status, v_release_after)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN NULL;
  END;

  -- Notify
  PERFORM public.notify_user(_user_id, 'reward_earned',
    '+' || v_rule.points || ' points',
    COALESCE(_reason, v_rule.description),
    '/rewards');

  RETURN v_id;
END $$;

-- ============= Release due rewards =============
CREATE OR REPLACE FUNCTION public.release_due_rewards()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT id, user_id, points, reason, reference_type, reference_id
    FROM public.reward_ledger
    WHERE status = 'pending' AND kind = 'earn'
      AND release_after IS NOT NULL AND release_after <= now()
    LIMIT 1000
  LOOP
    UPDATE public.reward_ledger SET status = 'available' WHERE id = r.id;
    INSERT INTO public.reward_ledger(user_id, kind, points, reason, reference_type, reference_id, status)
    VALUES (r.user_id, 'release', r.points, 'Escrow released: ' || r.reason, r.reference_type, r.reference_id, 'available');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- ============= Redeem helper (user-callable RPC) =============
CREATE OR REPLACE FUNCTION public.redeem_reward(
  _kind public.redemption_kind,
  _points integer,
  _applied_to_reference_type text DEFAULT NULL,
  _applied_to_reference_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance int;
  v_inr int;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _points <= 0 THEN RAISE EXCEPTION 'points must be positive'; END IF;

  SELECT available_points INTO v_balance FROM public.reward_accounts WHERE user_id = v_user;
  IF v_balance IS NULL OR v_balance < _points THEN
    RAISE EXCEPTION 'insufficient points (have %, need %)', COALESCE(v_balance, 0), _points;
  END IF;

  -- 100 points = ₹10 default conversion
  v_inr := (_points / 10);

  INSERT INTO public.reward_redemptions(user_id, kind, points_spent, inr_value, status,
    applied_to_reference_type, applied_to_reference_id, notes)
  VALUES (v_user, _kind, _points, v_inr, 'requested', _applied_to_reference_type, _applied_to_reference_id, _notes)
  RETURNING id INTO v_id;

  -- Debit immediately (held until applied; on rejection admin can adjust back)
  INSERT INTO public.reward_ledger(user_id, kind, points, reason, reference_type, reference_id, status)
  VALUES (v_user, 'redeem', _points, 'Redemption: ' || _kind::text, 'reward_redemption', v_id, 'redeemed');

  RETURN v_id;
END $$;

-- ============= Auto-award triggers =============

-- Booking completed
CREATE OR REPLACE FUNCTION public.tg_award_booking_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    PERFORM public.award_reward(NEW.customer_id, 'booking_completed', 'service_booking', NEW.id, 'Completed booking');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_award_booking_complete ON public.service_bookings;
CREATE TRIGGER tg_award_booking_complete
  AFTER UPDATE ON public.service_bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_award_booking_complete();

-- Mating agreement signed (both parties)
CREATE OR REPLACE FUNCTION public.tg_award_mating_signed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_from uuid; v_to uuid;
BEGIN
  IF NEW.from_signature IS NOT NULL AND NEW.to_signature IS NOT NULL
     AND (OLD.from_signature IS NULL OR OLD.to_signature IS NULL) THEN
    SELECT from_owner_id, to_owner_id INTO v_from, v_to
      FROM public.mating_requests WHERE id = NEW.request_id;
    PERFORM public.award_reward(v_from, 'mating_agreement_signed', 'mating_agreement', NEW.id, 'Mating agreement signed');
    PERFORM public.award_reward(v_to, 'mating_agreement_signed', 'mating_agreement', NEW.id, 'Mating agreement signed');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_award_mating_signed ON public.mating_agreements;
CREATE TRIGGER tg_award_mating_signed
  AFTER INSERT OR UPDATE ON public.mating_agreements
  FOR EACH ROW EXECUTE FUNCTION public.tg_award_mating_signed();

-- Streak milestones (hook into daily_streaks)
CREATE OR REPLACE FUNCTION public.tg_award_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_streak >= 7 AND COALESCE(OLD.current_streak, 0) < 7 THEN
    PERFORM public.award_reward(NEW.user_id, 'streak_7', 'daily_streak', NEW.user_id, '7-day streak');
  END IF;
  IF NEW.current_streak >= 30 AND COALESCE(OLD.current_streak, 0) < 30 THEN
    PERFORM public.award_reward(NEW.user_id, 'streak_30', 'daily_streak_30', NEW.user_id, '30-day streak');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_award_streak ON public.daily_streaks;
CREATE TRIGGER tg_award_streak
  AFTER INSERT OR UPDATE ON public.daily_streaks
  FOR EACH ROW EXECUTE FUNCTION public.tg_award_streak();
