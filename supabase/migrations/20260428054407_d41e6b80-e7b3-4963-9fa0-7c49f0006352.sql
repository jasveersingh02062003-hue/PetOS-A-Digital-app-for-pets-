DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vet';
EXCEPTION WHEN others THEN NULL; END $$;

CREATE TYPE public.consult_severity AS ENUM ('mild','moderate','severe');
CREATE TYPE public.consult_status AS ENUM ('awaiting_vet','assigned','in_progress','completed','cancelled');

CREATE TABLE public.vet_consults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  vet_id UUID,
  severity public.consult_severity NOT NULL DEFAULT 'moderate',
  status public.consult_status NOT NULL DEFAULT 'awaiting_vet',
  ai_summary TEXT,
  symptoms TEXT[],
  prescription TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_consults_owner ON public.vet_consults(owner_id);
CREATE INDEX idx_consults_vet ON public.vet_consults(vet_id);
CREATE INDEX idx_consults_status ON public.vet_consults(status);

ALTER TABLE public.vet_consults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consults_owner_view" ON public.vet_consults
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "consults_vet_view" ON public.vet_consults
  FOR SELECT TO authenticated USING (auth.uid() = vet_id OR public.has_role(auth.uid(), 'vet'));
CREATE POLICY "consults_admin_view" ON public.vet_consults
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "consults_owner_insert" ON public.vet_consults
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "consults_owner_cancel" ON public.vet_consults
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "consults_vet_update" ON public.vet_consults
  FOR UPDATE TO authenticated USING (auth.uid() = vet_id OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (auth.uid() = vet_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_consults_updated BEFORE UPDATE ON public.vet_consults
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();