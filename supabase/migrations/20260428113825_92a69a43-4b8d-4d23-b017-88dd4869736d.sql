
-- Broadcasts
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  target_city text,
  target_role text,
  recipients_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read broadcasts" ON public.broadcasts FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "super admins insert broadcasts" ON public.broadcasts FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') AND sender_id = auth.uid());

-- Feature flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read flags" ON public.feature_flags FOR SELECT USING (true);
CREATE POLICY "admins write flags" ON public.feature_flags FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Seed common flags
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('ai_chat', true, 'Enable AI chat assistant'),
  ('mating_module', true, 'Enable mating discovery & requests'),
  ('shop', true, 'Enable shop & marketplace'),
  ('walk_tracking', true, 'Enable live walk tracking'),
  ('vet_video', true, 'Enable vet tele-consult video room')
ON CONFLICT (key) DO NOTHING;

-- KPIs RPC
CREATE OR REPLACE FUNCTION public.admin_kpis()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT jsonb_build_object(
    'users_total', (SELECT count(*) FROM public.profiles),
    'users_new_7d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
    'pets_total', (SELECT count(*) FROM public.pets),
    'posts_today', (SELECT count(*) FROM public.posts WHERE created_at > now() - interval '1 day'),
    'bookings_today', (SELECT count(*) FROM public.service_bookings WHERE created_at > now() - interval '1 day'),
    'active_missing', (SELECT count(*) FROM public.missing_pets WHERE status = 'active'),
    'open_reports', (SELECT count(*) FROM public.reports WHERE status = 'open'),
    'pending_vet_apps', (SELECT count(*) FROM public.vet_applications WHERE status = 'pending'),
    'pending_provider_verify', (SELECT count(*) FROM public.service_providers WHERE verified = false),
    'vets_active', (SELECT count(*) FROM public.vet_profiles WHERE active = true AND onboarded = true),
    'plus_subscribers', (SELECT count(*) FROM public.subscriptions WHERE tier = 'plus' AND status IN ('active','trialing'))
  ) INTO r;
  RETURN r;
END $$;

-- Send broadcast
CREATE OR REPLACE FUNCTION public.send_broadcast(_title text, _body text, _link text, _target_city text DEFAULT NULL, _target_role text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid; v_count int := 0; rec record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  INSERT INTO public.broadcasts (sender_id, title, body, link, target_city, target_role)
  VALUES (auth.uid(), _title, _body, _link, _target_city, _target_role)
  RETURNING id INTO v_id;

  FOR rec IN
    SELECT DISTINCT p.id FROM public.profiles p
    LEFT JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE (_target_city IS NULL OR lower(p.city) = lower(_target_city))
      AND (_target_role IS NULL OR ur.role::text = _target_role)
  LOOP
    PERFORM public.notify_user(rec.id, 'broadcast', _title, _body, COALESCE(_link, '/'));
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.broadcasts SET recipients_count = v_count WHERE id = v_id;
  RETURN v_id;
END $$;
