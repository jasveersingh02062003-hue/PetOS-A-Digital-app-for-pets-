CREATE TABLE IF NOT EXISTS public.vet_visit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  vet_id uuid NOT NULL,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  subjective text,
  objective text,
  assessment text,
  plan text,
  follow_up_on date,
  photo_paths text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vvn_pet ON public.vet_visit_notes(pet_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_vvn_vet ON public.vet_visit_notes(vet_id);

ALTER TABLE public.vet_visit_notes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_pet_care_team_vet(_pet_id uuid, _vet_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pet_care_team
    WHERE pet_id = _pet_id AND vet_id = _vet_id AND revoked_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_pet_owner(_pet_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.pets WHERE id = _pet_id AND owner_id = _user_id);
$$;

CREATE POLICY "Owners and care-team vets can read visit notes"
ON public.vet_visit_notes FOR SELECT
USING (public.is_pet_owner(pet_id, auth.uid()) OR public.is_pet_care_team_vet(pet_id, auth.uid()));

CREATE POLICY "Care-team vets can insert visit notes"
ON public.vet_visit_notes FOR INSERT
WITH CHECK (vet_id = auth.uid() AND public.is_pet_care_team_vet(pet_id, auth.uid()));

CREATE POLICY "Authoring vet can update visit notes"
ON public.vet_visit_notes FOR UPDATE
USING (vet_id = auth.uid() AND public.is_pet_care_team_vet(pet_id, auth.uid()))
WITH CHECK (vet_id = auth.uid());

CREATE POLICY "Authoring vet can delete visit notes"
ON public.vet_visit_notes FOR DELETE
USING (vet_id = auth.uid());

CREATE TRIGGER trg_vvn_updated
BEFORE UPDATE ON public.vet_visit_notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.heat_cycle_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  start_on date NOT NULL,
  end_on date,
  intensity smallint CHECK (intensity BETWEEN 1 AND 5),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hcl_pet ON public.heat_cycle_logs(pet_id, start_on DESC);

ALTER TABLE public.heat_cycle_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage heat cycle logs"
ON public.heat_cycle_logs FOR ALL
USING (public.is_pet_owner(pet_id, auth.uid()))
WITH CHECK (public.is_pet_owner(pet_id, auth.uid()));

CREATE TRIGGER trg_hcl_updated
BEFORE UPDATE ON public.heat_cycle_logs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();