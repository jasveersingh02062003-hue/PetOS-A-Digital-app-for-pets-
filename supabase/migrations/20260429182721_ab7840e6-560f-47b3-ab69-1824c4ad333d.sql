CREATE TABLE public.kennel_daily_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.service_bookings(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  report_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  meals INTEGER NOT NULL DEFAULT 0,
  walks INTEGER NOT NULL DEFAULT 0,
  potty INTEGER NOT NULL DEFAULT 0,
  mood TEXT NOT NULL DEFAULT 'good', -- 'great' | 'good' | 'off'
  notes TEXT,
  incidents TEXT,
  photo_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_kdr_booking_date ON public.kennel_daily_reports(booking_id, report_date);
CREATE INDEX idx_kdr_provider_date ON public.kennel_daily_reports(provider_id, report_date DESC);

ALTER TABLE public.kennel_daily_reports ENABLE ROW LEVEL SECURITY;

-- Provider owner can fully manage reports they author for their providers
CREATE POLICY "Provider owner can read reports"
  ON public.kennel_daily_reports FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.service_providers sp
    WHERE sp.id = provider_id AND sp.owner_id = auth.uid()
  ));

CREATE POLICY "Provider owner can insert reports"
  ON public.kennel_daily_reports FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.service_providers sp
      WHERE sp.id = provider_id AND sp.owner_id = auth.uid()
    )
  );

CREATE POLICY "Provider owner can update reports"
  ON public.kennel_daily_reports FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.service_providers sp
    WHERE sp.id = provider_id AND sp.owner_id = auth.uid()
  ));

CREATE POLICY "Provider owner can delete reports"
  ON public.kennel_daily_reports FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.service_providers sp
    WHERE sp.id = provider_id AND sp.owner_id = auth.uid()
  ));

-- Customer (booking owner) can view reports about their booking
CREATE POLICY "Customer reads own booking reports"
  ON public.kennel_daily_reports FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.service_bookings b
    WHERE b.id = booking_id AND b.customer_id = auth.uid()
  ));

-- Trigger: bump updated_at + notify customer on insert
CREATE TRIGGER trg_kdr_updated_at
  BEFORE UPDATE ON public.kennel_daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

CREATE OR REPLACE FUNCTION public.handle_kennel_daily_report()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer UUID;
BEGIN
  SELECT customer_id INTO v_customer
  FROM public.service_bookings WHERE id = NEW.booking_id;

  IF v_customer IS NOT NULL AND v_customer <> NEW.author_id THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (
      v_customer,
      'kennel_daily_report',
      'Daily report from your kennel',
      COALESCE(NEW.notes, 'Today''s update is ready. Tap to see meals, walks and mood.'),
      '/bookings/recurring'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kdr_notify ON public.kennel_daily_reports;
CREATE TRIGGER trg_kdr_notify
  AFTER INSERT ON public.kennel_daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_kennel_daily_report();