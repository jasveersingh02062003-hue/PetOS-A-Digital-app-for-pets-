
-- Pregnancy status enum
DO $$ BEGIN
  CREATE TYPE public.pregnancy_status AS ENUM ('active','whelped','lost','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pregnancy_milestone_kind AS ENUM (
    'mating_confirmed','vet_check','ultrasound','weight','feeding_change','symptom','whelping_prep','whelped','note'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Pregnancies
CREATE TABLE IF NOT EXISTS public.pregnancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  dam_pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  sire_pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  mating_request_id uuid REFERENCES public.mating_requests(id) ON DELETE SET NULL,
  mating_date date,
  expected_whelp_date date,
  actual_whelp_date date,
  status public.pregnancy_status NOT NULL DEFAULT 'active',
  litter_id uuid REFERENCES public.litter_groups(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pregnancies_owner ON public.pregnancies(owner_id);
CREATE INDEX IF NOT EXISTS idx_pregnancies_dam ON public.pregnancies(dam_pet_id);
CREATE INDEX IF NOT EXISTS idx_pregnancies_status ON public.pregnancies(status) WHERE status = 'active';

ALTER TABLE public.pregnancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own pregnancies"
  ON public.pregnancies FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Vets with access can view pregnancies"
  ON public.pregnancies FOR SELECT
  USING (public.vet_can_read_pet(dam_pet_id));

CREATE TRIGGER tg_pregnancies_updated_at
  BEFORE UPDATE ON public.pregnancies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Milestones
CREATE TABLE IF NOT EXISTS public.pregnancy_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pregnancy_id uuid NOT NULL REFERENCES public.pregnancies(id) ON DELETE CASCADE,
  kind public.pregnancy_milestone_kind NOT NULL,
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric(6,2),
  notes text,
  attachment_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pregmile_preg ON public.pregnancy_milestones(pregnancy_id, occurred_on DESC);

ALTER TABLE public.pregnancy_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage milestones for own pregnancies"
  ON public.pregnancy_milestones FOR ALL
  USING (EXISTS (SELECT 1 FROM public.pregnancies p WHERE p.id = pregnancy_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pregnancies p WHERE p.id = pregnancy_id AND p.owner_id = auth.uid()));

CREATE POLICY "Vets with access can view milestones"
  ON public.pregnancy_milestones FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.pregnancies p
    WHERE p.id = pregnancy_id AND public.vet_can_read_pet(p.dam_pet_id)
  ));

CREATE TRIGGER tg_pregmile_updated_at
  BEFORE UPDATE ON public.pregnancy_milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-set expected whelp date if mating_date provided and expected omitted (canine ~63 days).
CREATE OR REPLACE FUNCTION public.tg_pregnancy_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.mating_date IS NOT NULL AND NEW.expected_whelp_date IS NULL THEN
    NEW.expected_whelp_date := NEW.mating_date + 63;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_pregnancies_defaults
  BEFORE INSERT OR UPDATE ON public.pregnancies
  FOR EACH ROW EXECUTE FUNCTION public.tg_pregnancy_defaults();

-- Daily reminder function: notify owners of pregnancies whose expected whelp is in <= 3 days
CREATE OR REPLACE FUNCTION public.notify_upcoming_whelpings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE rec RECORD; v_count int := 0; v_pet text;
BEGIN
  FOR rec IN
    SELECT p.id, p.owner_id, p.dam_pet_id, p.expected_whelp_date
    FROM public.pregnancies p
    WHERE p.status = 'active'
      AND p.expected_whelp_date IS NOT NULL
      AND p.expected_whelp_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 3
  LOOP
    SELECT name INTO v_pet FROM public.pets WHERE id = rec.dam_pet_id;
    PERFORM public.notify_user(
      rec.owner_id,
      'pregnancy_due',
      'Whelping soon for ' || COALESCE(v_pet, 'your pet'),
      'Expected on ' || to_char(rec.expected_whelp_date, 'DD Mon'),
      '/pregnancies/' || rec.id
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;
