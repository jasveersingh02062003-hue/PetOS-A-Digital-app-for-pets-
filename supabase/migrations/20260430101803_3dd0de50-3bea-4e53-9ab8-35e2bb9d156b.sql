ALTER TABLE public.medication_logs
  ADD COLUMN IF NOT EXISTS schedule_kind text,
  ADD COLUMN IF NOT EXISTS times_of_day text[],
  ADD COLUMN IF NOT EXISTS every_n_hours int;

ALTER TABLE public.medication_logs
  ADD CONSTRAINT medication_logs_schedule_kind_check
  CHECK (schedule_kind IS NULL OR schedule_kind IN ('once_daily','twice_daily','thrice_daily','every_n_hours','as_needed'))
  NOT VALID;

CREATE TABLE IF NOT EXISTS public.medication_doses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medication_id uuid NOT NULL REFERENCES public.medication_logs(id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  scheduled_at timestamptz NOT NULL,
  taken_at timestamptz,
  skipped boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (medication_id, scheduled_at)
);

CREATE INDEX IF NOT EXISTS idx_med_doses_pet_time ON public.medication_doses (pet_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_doses_med ON public.medication_doses (medication_id, scheduled_at);

ALTER TABLE public.medication_doses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "med_doses_owner_all" ON public.medication_doses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = medication_doses.pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = medication_doses.pet_id AND p.owner_id = auth.uid()));

CREATE POLICY "med_doses_care_team_read" ON public.medication_doses
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pet_care_team t WHERE t.pet_id = medication_doses.pet_id AND t.vet_id = auth.uid()));

CREATE TRIGGER trg_med_doses_updated
  BEFORE UPDATE ON public.medication_doses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Function: spawn next 7 days of doses for an active medication.
-- Idempotent via UNIQUE(medication_id, scheduled_at).
CREATE OR REPLACE FUNCTION public.spawn_medication_doses(_med_id uuid, _days int DEFAULT 7)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m RECORD;
  d date;
  t text;
  ts timestamptz;
  inserted int := 0;
  start_ts timestamptz;
  end_ts timestamptz;
BEGIN
  SELECT * INTO m FROM public.medication_logs WHERE id = _med_id;
  IF NOT FOUND OR NOT m.active OR m.schedule_kind IS NULL OR m.schedule_kind = 'as_needed' THEN
    RETURN 0;
  END IF;

  FOR d IN SELECT generate_series(GREATEST(m.start_on, CURRENT_DATE), LEAST(COALESCE(m.end_on, CURRENT_DATE + _days), CURRENT_DATE + _days), '1 day')::date LOOP
    IF m.schedule_kind IN ('once_daily','twice_daily','thrice_daily') AND m.times_of_day IS NOT NULL THEN
      FOREACH t IN ARRAY m.times_of_day LOOP
        BEGIN
          ts := (d::text || ' ' || t || ':00')::timestamptz;
          INSERT INTO public.medication_doses (medication_id, pet_id, owner_id, scheduled_at)
          VALUES (m.id, m.pet_id, (SELECT owner_id FROM public.pets WHERE id = m.pet_id), ts)
          ON CONFLICT (medication_id, scheduled_at) DO NOTHING;
          IF FOUND THEN inserted := inserted + 1; END IF;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END LOOP;
    ELSIF m.schedule_kind = 'every_n_hours' AND m.every_n_hours IS NOT NULL AND m.every_n_hours > 0 THEN
      start_ts := GREATEST(m.start_on::timestamptz, now() - interval '1 hour');
      end_ts := LEAST(COALESCE(m.end_on::timestamptz + interval '1 day', now() + (_days || ' days')::interval), now() + (_days || ' days')::interval);
      ts := start_ts;
      WHILE ts < end_ts LOOP
        INSERT INTO public.medication_doses (medication_id, pet_id, owner_id, scheduled_at)
        VALUES (m.id, m.pet_id, (SELECT owner_id FROM public.pets WHERE id = m.pet_id), ts)
        ON CONFLICT (medication_id, scheduled_at) DO NOTHING;
        IF FOUND THEN inserted := inserted + 1; END IF;
        ts := ts + (m.every_n_hours || ' hours')::interval;
      END LOOP;
      EXIT; -- one pass for hourly
    END IF;
  END LOOP;

  RETURN inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.spawn_medication_doses(uuid, int) TO authenticated;