
-- Severity enum for triage outcomes
DO $$ BEGIN
  CREATE TYPE public.triage_severity AS ENUM ('mild', 'moderate', 'severe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ vet_triage_sessions ============
CREATE TABLE IF NOT EXISTS public.vet_triage_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  -- Full conversation: [{role:'user'|'assistant', content:'...'}, ...]
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- AI-classified severity (set when triage classifier runs)
  severity public.triage_severity,
  ai_summary text,
  home_care text[] DEFAULT '{}',
  recommend_vet boolean DEFAULT false,
  -- If escalated to a live appointment
  escalated_to_appointment_id uuid,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_triage_owner ON public.vet_triage_sessions(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_triage_pet ON public.vet_triage_sessions(pet_id);
CREATE INDEX IF NOT EXISTS idx_triage_appt ON public.vet_triage_sessions(escalated_to_appointment_id);

ALTER TABLE public.vet_triage_sessions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER triage_set_updated
  BEFORE UPDATE ON public.vet_triage_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Owners: full control over their own sessions
CREATE POLICY "Owners view own triage sessions"
  ON public.vet_triage_sessions FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners create own triage sessions"
  ON public.vet_triage_sessions FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners update own triage sessions"
  ON public.vet_triage_sessions FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners delete own triage sessions"
  ON public.vet_triage_sessions FOR DELETE
  USING (auth.uid() = owner_id);

-- Vets: can read a triage session if it has been linked to an appointment they own.
CREATE POLICY "Vets view triage linked to their appointment"
  ON public.vet_triage_sessions FOR SELECT
  USING (
    escalated_to_appointment_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = vet_triage_sessions.escalated_to_appointment_id
        AND a.vet_id = auth.uid()
    )
  );

-- ============ Link triage to appointments ============
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS triage_session_id uuid REFERENCES public.vet_triage_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appts_triage ON public.appointments(triage_session_id) WHERE triage_session_id IS NOT NULL;
