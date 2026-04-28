CREATE OR REPLACE FUNCTION public.apply_redemption(_id uuid, _status public.redemption_status, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _status NOT IN ('applied','rejected') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  SELECT * INTO r FROM public.reward_redemptions WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'redemption not found'; END IF;
  IF r.status NOT IN ('requested','approved') THEN
    RAISE EXCEPTION 'redemption already finalized: %', r.status;
  END IF;

  UPDATE public.reward_redemptions
    SET status = _status, notes = COALESCE(_notes, notes)
    WHERE id = _id;

  IF _status = 'rejected' THEN
    -- Refund points
    INSERT INTO public.reward_ledger(user_id, kind, points, reason, reference_type, reference_id, status)
    VALUES (r.user_id, 'adjust', r.points_spent, 'Refund: rejected redemption', 'reward_redemption', r.id, 'available');
    PERFORM public.notify_user(r.user_id, 'reward_refund', 'Redemption rejected',
      'Your ' || r.points_spent || ' points have been refunded.', '/rewards');
  ELSIF _status = 'applied' THEN
    PERFORM public.notify_user(r.user_id, 'reward_applied', 'Redemption applied',
      'Your reward has been applied to your account.', '/rewards');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_provider_trust_status(_provider_id uuid, _status text, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _status NOT IN ('pending','verified','rejected') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  UPDATE public.service_providers
    SET trust_status = _status,
        verified = (_status = 'verified')
    WHERE id = _provider_id;

  PERFORM public.notify_user(
    (SELECT owner_id FROM public.service_providers WHERE id = _provider_id),
    'trust_status',
    'Verification ' || _status,
    COALESCE(_notes, 'Your provider verification status has been updated.'),
    '/services/manage'
  );
END $$;