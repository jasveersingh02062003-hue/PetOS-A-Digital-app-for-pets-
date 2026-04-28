
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.appointment_mode AS ENUM ('chat','video','in_clinic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.appointment_status AS ENUM ('requested','confirmed','in_progress','completed','cancelled','no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.parasite_type AS ENUM ('flea','tick','heartworm','dewormer','combination','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.access_request_status AS ENUM ('pending','approved','rejected','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ PETS COLUMN ADDITIONS ============
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS public_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS microchip_id text,
  ADD COLUMN IF NOT EXISTS insurance_provider text,
  ADD COLUMN IF NOT EXISTS insurance_policy text,
  ADD COLUMN IF NOT EXISTS current_medications text,
  ADD COLUMN IF NOT EXISTS blood_type text,
  ADD COLUMN IF NOT EXISTS primary_vet_id uuid;

-- Function to mint a unique short pet id
CREATE OR REPLACE FUNCTION public.generate_pet_public_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_id text;
  v_exists boolean;
BEGIN
  LOOP
    v_id := 'PET-' ||
      substr(v_chars, 1+floor(random()*32)::int, 1) ||
      substr(v_chars, 1+floor(random()*32)::int, 1) ||
      substr(v_chars, 1+floor(random()*32)::int, 1) ||
      substr(v_chars, 1+floor(random()*32)::int, 1) ||
      substr(v_chars, 1+floor(random()*32)::int, 1);
    SELECT EXISTS(SELECT 1 FROM public.pets WHERE public_id = v_id) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_id;
END $$;

-- Trigger to auto-assign public_id on insert
CREATE OR REPLACE FUNCTION public.set_pet_public_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.public_id IS NULL THEN
    NEW.public_id := public.generate_pet_public_id();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pets_set_public_id ON public.pets;
CREATE TRIGGER pets_set_public_id
  BEFORE INSERT ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.set_pet_public_id();

-- Backfill existing pets
UPDATE public.pets SET public_id = public.generate_pet_public_id() WHERE public_id IS NULL;

-- ============ VET CARE TEAM (defined early - used by RLS below) ============
CREATE TABLE IF NOT EXISTS public.pet_care_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  vet_id uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(pet_id, vet_id)
);
CREATE INDEX IF NOT EXISTS idx_pct_vet ON public.pet_care_team(vet_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pct_pet ON public.pet_care_team(pet_id) WHERE revoked_at IS NULL;
ALTER TABLE public.pet_care_team ENABLE ROW LEVEL SECURITY;

-- ============ APPOINTMENTS (defined early - used by RLS) ============
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  pet_id uuid NOT NULL,
  mode public.appointment_mode NOT NULL DEFAULT 'chat',
  status public.appointment_status NOT NULL DEFAULT 'requested',
  scheduled_at timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 30,
  video_room_url text,
  video_room_name text,
  notes text,
  prescription text,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appts_vet_time ON public.appointments(vet_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appts_owner ON public.appointments(owner_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_appts_pet ON public.appointments(pet_id);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER appts_set_updated BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper function: does the current user (vet) have read access to this pet?
CREATE OR REPLACE FUNCTION public.vet_can_read_pet(_pet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pet_care_team
    WHERE pet_id = _pet_id AND vet_id = auth.uid() AND revoked_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.vet_access_grants g
    JOIN public.user_roles ur ON ur.user_id = auth.uid() AND ur.role = 'vet'
    WHERE g.pet_id = _pet_id
      AND g.revoked = false
      AND g.expires_at > now()
  ) OR EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.pet_id = _pet_id
      AND a.vet_id = auth.uid()
      AND a.status IN ('requested','confirmed','in_progress','completed')
  );
$$;

-- ============ HEALTH: VITAL LOGS ============
CREATE TABLE IF NOT EXISTS public.vital_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  weight_kg numeric,
  body_condition smallint,
  temperature_c numeric,
  heart_rate_bpm int,
  respiratory_rate_rpm int,
  gum_colour text,
  hydration text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vitals_pet_time ON public.vital_logs(pet_id, recorded_at DESC);
ALTER TABLE public.vital_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY vitals_owner_all ON public.vital_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = vital_logs.pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = vital_logs.pet_id AND p.owner_id = auth.uid()));
CREATE POLICY vitals_vet_read ON public.vital_logs FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(pet_id));

-- ============ HEALTH: PARASITE PREVENTATIVES ============
CREATE TABLE IF NOT EXISTS public.parasite_preventatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  product_name text NOT NULL,
  parasite_type public.parasite_type NOT NULL DEFAULT 'combination',
  given_on date NOT NULL DEFAULT CURRENT_DATE,
  next_due_on date,
  batch_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_parasite_pet ON public.parasite_preventatives(pet_id, given_on DESC);
ALTER TABLE public.parasite_preventatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY parasite_owner_all ON public.parasite_preventatives FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = parasite_preventatives.pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = parasite_preventatives.pet_id AND p.owner_id = auth.uid()));
CREATE POLICY parasite_vet_read ON public.parasite_preventatives FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(pet_id));

-- ============ HEALTH: MEDICATION LOGS ============
CREATE TABLE IF NOT EXISTS public.medication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  name text NOT NULL,
  dose text,
  route text,
  frequency text,
  start_on date NOT NULL DEFAULT CURRENT_DATE,
  end_on date,
  prescribing_vet text,
  reason text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meds_pet ON public.medication_logs(pet_id, start_on DESC);
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER meds_set_updated BEFORE UPDATE ON public.medication_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY meds_owner_all ON public.medication_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = medication_logs.pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = medication_logs.pet_id AND p.owner_id = auth.uid()));
CREATE POLICY meds_vet_read ON public.medication_logs FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(pet_id));

-- ============ HEALTH: ACTIVITY LOGS ============
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  logged_for date NOT NULL DEFAULT CURRENT_DATE,
  walk_minutes int,
  energy smallint,
  sleep_hours numeric,
  mood text[],
  stool_score smallint,
  urine_frequency int,
  water_ml int,
  appetite smallint,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_pet ON public.activity_logs(pet_id, logged_for DESC);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_owner_all ON public.activity_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = activity_logs.pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = activity_logs.pet_id AND p.owner_id = auth.uid()));
CREATE POLICY activity_vet_read ON public.activity_logs FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(pet_id));

-- ============ HEALTH: REPRO LOGS ============
CREATE TABLE IF NOT EXISTS public.repro_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  event_type text NOT NULL,
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  partner_pet_id uuid,
  litter_count int,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_repro_pet ON public.repro_logs(pet_id, occurred_on DESC);
ALTER TABLE public.repro_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY repro_owner_all ON public.repro_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = repro_logs.pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = repro_logs.pet_id AND p.owner_id = auth.uid()));
CREATE POLICY repro_vet_read ON public.repro_logs FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(pet_id));

-- Also extend vet read access to existing health tables
CREATE POLICY vaccinations_vet_read ON public.vaccinations FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(pet_id));
CREATE POLICY health_records_vet_read ON public.health_records FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(pet_id));
CREATE POLICY symptom_logs_vet_read ON public.symptom_logs FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(pet_id));
CREATE POLICY nutrition_logs_vet_read ON public.nutrition_logs FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(pet_id));

-- Pets row read for vet on care-team / grant / appointment
CREATE POLICY pets_vet_read ON public.pets FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(id));

-- ============ VET PROFILES ============
CREATE TABLE IF NOT EXISTS public.vet_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text NOT NULL,
  photo_url text,
  bio text,
  languages text[] NOT NULL DEFAULT '{}',
  license_number text NOT NULL,
  license_council text,
  year_qualified int,
  license_doc_path text,
  clinic_name text,
  address text,
  city text,
  lat numeric,
  lng numeric,
  phone text,
  specialisations text[] NOT NULL DEFAULT '{}',
  consult_modes public.appointment_mode[] NOT NULL DEFAULT ARRAY['chat','video']::public.appointment_mode[],
  default_duration_min int NOT NULL DEFAULT 30,
  price_chat_inr int NOT NULL DEFAULT 0,
  price_video_inr int NOT NULL DEFAULT 0,
  price_clinic_inr int NOT NULL DEFAULT 0,
  onboarded boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  rating_avg numeric,
  rating_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vet_profiles_city ON public.vet_profiles(city);
ALTER TABLE public.vet_profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER vet_profiles_set_updated BEFORE UPDATE ON public.vet_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY vet_profiles_self_all ON public.vet_profiles FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY vet_profiles_public_read ON public.vet_profiles FOR SELECT TO authenticated
  USING (active = true AND onboarded = true);

-- ============ VET AVAILABILITY ============
CREATE TABLE IF NOT EXISTS public.vet_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  mode public.appointment_mode NOT NULL DEFAULT 'chat',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_avail_vet ON public.vet_availability(vet_id, weekday);
ALTER TABLE public.vet_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY avail_self_all ON public.vet_availability FOR ALL TO authenticated
  USING (vet_id = auth.uid()) WITH CHECK (vet_id = auth.uid());
CREATE POLICY avail_public_read ON public.vet_availability FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.vet_availability_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id uuid NOT NULL,
  override_date date NOT NULL,
  is_blocked boolean NOT NULL DEFAULT true,
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_avail_ovr_vet ON public.vet_availability_overrides(vet_id, override_date);
ALTER TABLE public.vet_availability_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY avail_ovr_self_all ON public.vet_availability_overrides FOR ALL TO authenticated
  USING (vet_id = auth.uid()) WITH CHECK (vet_id = auth.uid());
CREATE POLICY avail_ovr_public_read ON public.vet_availability_overrides FOR SELECT TO authenticated USING (true);

-- ============ PET CARE TEAM POLICIES ============
CREATE POLICY pct_owner_all ON public.pet_care_team FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_care_team.pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_care_team.pet_id AND p.owner_id = auth.uid()));
CREATE POLICY pct_vet_read ON public.pet_care_team FOR SELECT TO authenticated
  USING (vet_id = auth.uid());

-- ============ PET ACCESS REQUESTS ============
CREATE TABLE IF NOT EXISTS public.pet_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id uuid NOT NULL,
  pet_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  message text,
  status public.access_request_status NOT NULL DEFAULT 'pending',
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_par_owner ON public.pet_access_requests(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_par_vet ON public.pet_access_requests(vet_id);
ALTER TABLE public.pet_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY par_vet_insert ON public.pet_access_requests FOR INSERT TO authenticated
  WITH CHECK (vet_id = auth.uid() AND public.has_role(auth.uid(), 'vet'::app_role));
CREATE POLICY par_party_select ON public.pet_access_requests FOR SELECT TO authenticated
  USING (vet_id = auth.uid() OR owner_id = auth.uid());
CREATE POLICY par_owner_update ON public.pet_access_requests FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- When owner approves an access request, create / reactivate the care-team link
CREATE OR REPLACE FUNCTION public.on_access_request_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.pet_care_team (pet_id, vet_id)
    VALUES (NEW.pet_id, NEW.vet_id)
    ON CONFLICT (pet_id, vet_id) DO UPDATE SET revoked_at = NULL, granted_at = now();
    NEW.responded_at := now();
    PERFORM public.notify_user(NEW.vet_id, 'access_approved',
      'Pet access approved', 'You can now view this pet''s health records.', '/vet');
  ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    NEW.responded_at := now();
    PERFORM public.notify_user(NEW.vet_id, 'access_rejected',
      'Pet access rejected', NULL, '/vet');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS par_decision ON public.pet_access_requests;
CREATE TRIGGER par_decision
  BEFORE UPDATE ON public.pet_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_access_request_decision();

-- Notify owner on new access request
CREATE OR REPLACE FUNCTION public.on_access_request_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pet_name text;
BEGIN
  SELECT name INTO v_pet_name FROM public.pets WHERE id = NEW.pet_id;
  PERFORM public.notify_user(NEW.owner_id, 'access_request',
    'A vet wants to access ' || COALESCE(v_pet_name, 'your pet'),
    NEW.message,
    '/profile');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS par_insert_notify ON public.pet_access_requests;
CREATE TRIGGER par_insert_notify
  AFTER INSERT ON public.pet_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_access_request_insert();

-- ============ APPOINTMENTS POLICIES ============
CREATE POLICY appts_owner_insert ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()));
CREATE POLICY appts_party_select ON public.appointments FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR vet_id = auth.uid());
CREATE POLICY appts_party_update ON public.appointments FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR vet_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() OR vet_id = auth.uid());

-- Notify on appointment lifecycle
CREATE OR REPLACE FUNCTION public.on_appointment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_user(NEW.vet_id, 'appt_new',
      'New appointment request',
      'Mode: ' || NEW.mode::text || ' on ' || to_char(NEW.scheduled_at, 'DD Mon HH24:MI'),
      '/vet');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(NEW.owner_id, 'appt_status',
      'Appointment ' || NEW.status::text,
      'Update on your appointment',
      '/profile');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS appts_event ON public.appointments;
CREATE TRIGGER appts_event
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.on_appointment_event();

-- ============ APPOINTMENT MESSAGES ============
CREATE TABLE IF NOT EXISTS public.appointment_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appt_msgs ON public.appointment_messages(appointment_id, created_at);
ALTER TABLE public.appointment_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY appt_msgs_party_select ON public.appointment_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_messages.appointment_id
      AND (a.owner_id = auth.uid() OR a.vet_id = auth.uid())));
CREATE POLICY appt_msgs_party_insert ON public.appointment_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_messages.appointment_id
        AND (a.owner_id = auth.uid() OR a.vet_id = auth.uid())));

ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
