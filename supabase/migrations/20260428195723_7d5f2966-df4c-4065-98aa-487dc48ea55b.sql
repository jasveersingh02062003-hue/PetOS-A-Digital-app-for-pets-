-- Provider trust columns
ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS trust_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS id_proof_path text,
  ADD COLUMN IF NOT EXISTS address_proof_path text,
  ADD COLUMN IF NOT EXISTS quiz_passed_at timestamptz,
  ADD COLUMN IF NOT EXISTS quiz_score integer,
  ADD COLUMN IF NOT EXISTS years_experience integer;

-- Validate trust_status values
CREATE OR REPLACE FUNCTION public.tg_validate_provider_trust()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.trust_status NOT IN ('none','pending','verified','rejected') THEN
    RAISE EXCEPTION 'Invalid trust_status: %', NEW.trust_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_provider_trust ON public.service_providers;
CREATE TRIGGER validate_provider_trust
  BEFORE INSERT OR UPDATE ON public.service_providers
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_provider_trust();

-- Quiz attempts
CREATE TABLE IF NOT EXISTS public.provider_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL,
  total integer NOT NULL,
  passed boolean NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_quiz_attempts_provider_idx ON public.provider_quiz_attempts(provider_id);
CREATE INDEX IF NOT EXISTS provider_quiz_attempts_user_idx ON public.provider_quiz_attempts(user_id);

ALTER TABLE public.provider_quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quiz: provider can read own"
  ON public.provider_quiz_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator'));

CREATE POLICY "quiz: provider can insert own"
  ON public.provider_quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.service_providers WHERE id = provider_id AND owner_id = auth.uid())
  );

-- When a passing attempt is recorded, update the provider profile
CREATE OR REPLACE FUNCTION public.tg_apply_quiz_pass()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.passed = true THEN
    UPDATE public.service_providers
       SET quiz_passed_at = COALESCE(quiz_passed_at, now()),
           quiz_score = GREATEST(COALESCE(quiz_score, 0), NEW.score)
     WHERE id = NEW.provider_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_quiz_pass ON public.provider_quiz_attempts;
CREATE TRIGGER apply_quiz_pass
  AFTER INSERT ON public.provider_quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.tg_apply_quiz_pass();

-- Recurring bookings
CREATE TABLE IF NOT EXISTS public.recurring_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  frequency text NOT NULL DEFAULT 'weekly',
  weekdays smallint[] NOT NULL DEFAULT '{}'::smallint[],
  time_of_day time NOT NULL,
  start_date date NOT NULL,
  end_date date,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_customer_idx ON public.recurring_bookings(customer_id);
CREATE INDEX IF NOT EXISTS recurring_provider_idx ON public.recurring_bookings(provider_id);

CREATE OR REPLACE FUNCTION public.tg_validate_recurring_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.frequency NOT IN ('weekly','biweekly','monthly') THEN
    RAISE EXCEPTION 'Invalid frequency: %', NEW.frequency;
  END IF;
  IF NEW.status NOT IN ('active','paused','cancelled') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.end_date IS NOT NULL AND NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'end_date must be on or after start_date';
  END IF;
  IF array_length(NEW.weekdays, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one weekday required';
  END IF;
  -- weekdays: 0=Sun..6=Sat
  IF EXISTS (SELECT 1 FROM unnest(NEW.weekdays) w WHERE w < 0 OR w > 6) THEN
    RAISE EXCEPTION 'weekdays must be between 0 and 6';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_recurring_booking ON public.recurring_bookings;
CREATE TRIGGER validate_recurring_booking
  BEFORE INSERT OR UPDATE ON public.recurring_bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_recurring_booking();

ALTER TABLE public.recurring_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring: parties read"
  ON public.recurring_bookings FOR SELECT TO authenticated
  USING (
    auth.uid() = customer_id
    OR EXISTS (SELECT 1 FROM public.service_providers WHERE id = provider_id AND owner_id = auth.uid())
  );

CREATE POLICY "recurring: customer insert"
  ON public.recurring_bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "recurring: parties update"
  ON public.recurring_bookings FOR UPDATE TO authenticated
  USING (
    auth.uid() = customer_id
    OR EXISTS (SELECT 1 FROM public.service_providers WHERE id = provider_id AND owner_id = auth.uid())
  );

CREATE POLICY "recurring: customer delete"
  ON public.recurring_bookings FOR DELETE TO authenticated
  USING (auth.uid() = customer_id);

-- Link generated occurrences back to the recurring schedule
ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS parent_recurring_id uuid REFERENCES public.recurring_bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS service_bookings_parent_recurring_idx ON public.service_bookings(parent_recurring_id);

-- Storage bucket for trust documents (private, owner-only)
INSERT INTO storage.buckets (id, name, public)
VALUES ('trust-docs','trust-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "trust-docs: owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'trust-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "trust-docs: owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'trust-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "trust-docs: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'trust-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "trust-docs: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'trust-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "trust-docs: admins read all"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'trust-docs'
    AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator'))
  );