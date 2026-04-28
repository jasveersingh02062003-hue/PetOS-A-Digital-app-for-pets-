CREATE TABLE public.boarding_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  service_type TEXT NOT NULL DEFAULT 'boarding',
  price_inr_per_day INTEGER,
  city TEXT,
  photos TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.boarding_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boarding_select_active_or_owner"
ON public.boarding_services FOR SELECT TO authenticated
USING (active = true OR owner_id = auth.uid());

CREATE POLICY "boarding_insert_own"
ON public.boarding_services FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "boarding_update_own"
ON public.boarding_services FOR UPDATE TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "boarding_delete_own"
ON public.boarding_services FOR DELETE TO authenticated
USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_boarding_services_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_boarding_services_updated_at
BEFORE UPDATE ON public.boarding_services
FOR EACH ROW EXECUTE FUNCTION public.tg_boarding_services_touch();

CREATE INDEX idx_boarding_services_owner ON public.boarding_services(owner_id);
CREATE INDEX idx_boarding_services_active ON public.boarding_services(active) WHERE active = true;