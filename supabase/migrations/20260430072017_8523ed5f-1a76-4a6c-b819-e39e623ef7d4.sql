-- 1) Provider hub columns
ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS next_available_at timestamptz,
  ADD COLUMN IF NOT EXISTS service_area_radius_km numeric;

CREATE INDEX IF NOT EXISTS idx_providers_next_avail
  ON public.service_providers(next_available_at)
  WHERE active AND next_available_at IS NOT NULL;

-- 2) Provider weekly hours
CREATE TABLE IF NOT EXISTS public.provider_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Sun
  open_time time NOT NULL,
  close_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_hours_provider
  ON public.provider_hours(provider_id, weekday);

ALTER TABLE public.provider_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY provider_hours_select_all ON public.provider_hours
FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY provider_hours_owner_insert ON public.provider_hours
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.service_providers p
  WHERE p.id = provider_hours.provider_id AND p.owner_id = auth.uid()
));

CREATE POLICY provider_hours_owner_update ON public.provider_hours
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.service_providers p
  WHERE p.id = provider_hours.provider_id AND p.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.service_providers p
  WHERE p.id = provider_hours.provider_id AND p.owner_id = auth.uid()
));

CREATE POLICY provider_hours_owner_delete ON public.provider_hours
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.service_providers p
  WHERE p.id = provider_hours.provider_id AND p.owner_id = auth.uid()
));

-- 3) Open-now helper (uses server time; client passes local TZ if needed in v2)
CREATE OR REPLACE FUNCTION public.is_provider_open_now(_provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.provider_hours ph
    WHERE ph.provider_id = _provider_id
      AND ph.weekday = EXTRACT(DOW FROM now())::smallint
      AND now()::time BETWEEN ph.open_time AND ph.close_time
  );
$$;

REVOKE ALL ON FUNCTION public.is_provider_open_now(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_provider_open_now(uuid) TO anon, authenticated;

-- 4) Convenience: list of currently-open provider ids for a category/city
CREATE OR REPLACE FUNCTION public.providers_open_now(_category text DEFAULT NULL, _city text DEFAULT NULL)
RETURNS TABLE(provider_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT sp.id
  FROM public.service_providers sp
  JOIN public.provider_hours ph ON ph.provider_id = sp.id
  WHERE sp.active
    AND (_category IS NULL OR sp.category::text = _category)
    AND (_city IS NULL OR sp.city ILIKE '%' || _city || '%')
    AND ph.weekday = EXTRACT(DOW FROM now())::smallint
    AND now()::time BETWEEN ph.open_time AND ph.close_time;
$$;

REVOKE ALL ON FUNCTION public.providers_open_now(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.providers_open_now(text, text) TO anon, authenticated;