-- Phase 24: Shop reorder reminders
CREATE TABLE public.shop_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  cadence_days INT NOT NULL CHECK (cadence_days BETWEEN 7 AND 180),
  next_run_on DATE NOT NULL,
  last_notified_on DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shop_reminders_user ON public.shop_reminders(user_id) WHERE active;
CREATE INDEX idx_shop_reminders_due ON public.shop_reminders(next_run_on) WHERE active;

ALTER TABLE public.shop_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own shop_reminders"
  ON public.shop_reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owner inserts own shop_reminders"
  ON public.shop_reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner updates own shop_reminders"
  ON public.shop_reminders FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner deletes own shop_reminders"
  ON public.shop_reminders FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger: set next_run_on lead-time (cadence_days - 3, min today)
CREATE OR REPLACE FUNCTION public.tg_shop_reminder_set_next_run()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.next_run_on IS NULL THEN
      NEW.next_run_on := CURRENT_DATE + GREATEST(NEW.cadence_days - 3, 1);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.cadence_days <> OLD.cadence_days THEN
      NEW.next_run_on := COALESCE(NEW.last_notified_on, CURRENT_DATE) + GREATEST(NEW.cadence_days - 3, 1);
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_shop_reminder_set_next_run
  BEFORE INSERT OR UPDATE ON public.shop_reminders
  FOR EACH ROW EXECUTE FUNCTION public.tg_shop_reminder_set_next_run();