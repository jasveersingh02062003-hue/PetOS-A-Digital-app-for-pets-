-- 1) Radius fanout helper
CREATE OR REPLACE FUNCTION public.find_users_within_radius_km(
  _lat numeric, _lng numeric, _radius_km numeric, _exclude_user uuid DEFAULT NULL
)
RETURNS TABLE(user_id uuid, distance_km numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id,
         (earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(p.lat, p.lng))/1000)::numeric AS distance_km
  FROM public.profiles p
  WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
    AND (_exclude_user IS NULL OR p.id <> _exclude_user)
    AND earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(p.lat, p.lng)) <= _radius_km*1000
  ORDER BY distance_km
  LIMIT 500;
$$;

-- 2) Reward escrow columns + enum value + release RPC
ALTER TABLE public.missing_pets
  ADD COLUMN IF NOT EXISTS reward_payment_intent_id uuid REFERENCES public.payment_intents(id),
  ADD COLUMN IF NOT EXISTS reward_status text NOT NULL DEFAULT 'none'
    CHECK (reward_status IN ('none','escrowed','released','refunded')),
  ADD COLUMN IF NOT EXISTS reward_finder_id uuid,
  ADD COLUMN IF NOT EXISTS reward_released_at timestamptz;

DO $$ BEGIN
  ALTER TYPE public.payment_kind ADD VALUE IF NOT EXISTS 'reward_escrow';
EXCEPTION WHEN others THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.release_reward(
  _missing_pet_id uuid,
  _finder_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE m record; pi record;
BEGIN
  SELECT * INTO m FROM public.missing_pets WHERE id = _missing_pet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing pet not found'; END IF;
  IF m.owner_id <> auth.uid() THEN RAISE EXCEPTION 'Only the owner can release the reward'; END IF;
  IF m.reward_status <> 'escrowed' THEN RAISE EXCEPTION 'No reward in escrow'; END IF;
  IF _finder_id = m.owner_id THEN RAISE EXCEPTION 'Finder cannot be the owner'; END IF;

  SELECT * INTO pi FROM public.payment_intents WHERE id = m.reward_payment_intent_id;
  IF NOT FOUND OR pi.status <> 'paid' THEN RAISE EXCEPTION 'Reward payment not paid'; END IF;

  INSERT INTO public.provider_payouts(payment_intent_id, recipient_user_id, amount_inr, status, kind)
  VALUES (pi.id, _finder_id, pi.amount_inr, 'pending', 'reward')
  ON CONFLICT DO NOTHING;

  UPDATE public.missing_pets
  SET reward_status='released', reward_finder_id=_finder_id, reward_released_at=now(),
      status='resolved', resolved_at=COALESCE(resolved_at, now())
  WHERE id = _missing_pet_id;

  PERFORM public.notify_user(
    _finder_id, 'reward', 'Reward released 🎉',
    'The owner released the reward for finding their pet.',
    '/missing/' || _missing_pet_id::text
  );

  RETURN jsonb_build_object('ok', true, 'finder_id', _finder_id, 'amount_inr', pi.amount_inr);
END;
$$;
GRANT EXECUTE ON FUNCTION public.release_reward(uuid, uuid) TO authenticated;

-- 3) Driver live location
ALTER TABLE public.transport_bookings
  ADD COLUMN IF NOT EXISTS driver_lat numeric,
  ADD COLUMN IF NOT EXISTS driver_lng numeric,
  ADD COLUMN IF NOT EXISTS driver_location_at timestamptz;

CREATE OR REPLACE FUNCTION public.update_driver_location(
  _booking_id uuid, _lat numeric, _lng numeric
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE is_driver boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.transport_bookings tb
    JOIN public.service_providers sp ON sp.id = tb.provider_id
    WHERE tb.id = _booking_id AND sp.owner_id = auth.uid()
      AND tb.status NOT IN ('cancelled','dropped_off')
  ) INTO is_driver;
  IF NOT is_driver THEN RAISE EXCEPTION 'Not authorised to update this trip'; END IF;
  UPDATE public.transport_bookings
  SET driver_lat=_lat, driver_lng=_lng, driver_location_at=now()
  WHERE id=_booking_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_driver_location(uuid, numeric, numeric) TO authenticated;

ALTER TABLE public.transport_bookings REPLICA IDENTITY FULL;