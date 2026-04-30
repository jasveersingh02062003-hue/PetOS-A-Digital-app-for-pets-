
-- ===== Slice 1: health_alerts =====
CREATE TABLE IF NOT EXISTS public.health_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  pet_id UUID,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','watch','action','emergency')),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  dedupe_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS health_alerts_dedupe_idx
  ON public.health_alerts (owner_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS health_alerts_owner_recent_idx
  ON public.health_alerts (owner_id, created_at DESC);

ALTER TABLE public.health_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner read alerts"
  ON public.health_alerts FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "owner update alerts"
  ON public.health_alerts FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "owner delete alerts"
  ON public.health_alerts FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.enqueue_health_alert(
  _owner_id UUID,
  _pet_id UUID,
  _kind TEXT,
  _severity TEXT,
  _title TEXT,
  _body TEXT,
  _link TEXT,
  _dedupe_key TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
BEGIN
  IF _dedupe_key IS NOT NULL THEN
    SELECT id INTO _id FROM public.health_alerts
    WHERE owner_id = _owner_id AND dedupe_key = _dedupe_key AND dismissed_at IS NULL
    LIMIT 1;
    IF _id IS NOT NULL THEN
      RETURN _id;
    END IF;
  END IF;
  INSERT INTO public.health_alerts (owner_id, pet_id, kind, severity, title, body, link, dedupe_key)
  VALUES (_owner_id, _pet_id, _kind, COALESCE(_severity,'info'), _title, _body, _link, _dedupe_key)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.health_alerts;

-- ===== Slice 2: symptom_logs.resolved_at =====
ALTER TABLE public.symptom_logs
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- ===== Slice 5: vet_access_grants.scope + vet_access_views =====
ALTER TABLE public.vet_access_grants
  ADD COLUMN IF NOT EXISTS scope TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS public.vet_access_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES public.vet_access_grants(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  section TEXT,
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS vet_access_views_grant_idx
  ON public.vet_access_views (grant_id, viewed_at DESC);

ALTER TABLE public.vet_access_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can read grant views"
  ON public.vet_access_views FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vet_access_grants g
    WHERE g.id = vet_access_views.grant_id AND g.created_by = auth.uid()
  ));
