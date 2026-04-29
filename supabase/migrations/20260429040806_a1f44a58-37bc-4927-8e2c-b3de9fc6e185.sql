-- Phase 26: Pet taxi
CREATE TYPE public.transport_status AS ENUM (
  'requested','accepted','en_route_pickup','picked_up','en_route_drop','dropped_off','cancelled'
);

CREATE TABLE public.transport_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.service_providers(id) ON DELETE SET NULL,
  pet_id UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  service_booking_id UUID REFERENCES public.service_bookings(id) ON DELETE SET NULL,
  pickup_address TEXT NOT NULL,
  pickup_lat NUMERIC, pickup_lng NUMERIC,
  dropoff_address TEXT NOT NULL,
  dropoff_lat NUMERIC, dropoff_lng NUMERIC,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status public.transport_status NOT NULL DEFAULT 'requested',
  fare_inr INTEGER,
  notes TEXT,
  public_share_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transport_customer ON public.transport_bookings(customer_id, scheduled_at DESC);
CREATE INDEX idx_transport_provider ON public.transport_bookings(provider_id, scheduled_at DESC);

CREATE TABLE public.transport_legs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.transport_bookings(id) ON DELETE CASCADE,
  kind public.transport_status NOT NULL,
  lat NUMERIC, lng NUMERIC,
  note TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_transport_legs_booking ON public.transport_legs(booking_id, at DESC);

ALTER TABLE public.transport_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_legs ENABLE ROW LEVEL SECURITY;

-- Helper: is current user the assigned driver?
CREATE OR REPLACE FUNCTION public.is_transport_driver(_booking UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.transport_bookings tb
    JOIN public.service_providers sp ON sp.id = tb.provider_id
    WHERE tb.id = _booking AND sp.owner_id = auth.uid()
  );
$$;

-- transport_bookings policies
CREATE POLICY "Customer reads own taxi"
  ON public.transport_bookings FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "Driver reads assigned taxi"
  ON public.transport_bookings FOR SELECT
  USING (provider_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.service_providers sp
    WHERE sp.id = transport_bookings.provider_id AND sp.owner_id = auth.uid()
  ));

CREATE POLICY "Customer creates taxi"
  ON public.transport_bookings FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customer updates own taxi"
  ON public.transport_bookings FOR UPDATE
  USING (auth.uid() = customer_id) WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Driver updates assigned taxi"
  ON public.transport_bookings FOR UPDATE
  USING (provider_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.service_providers sp
    WHERE sp.id = transport_bookings.provider_id AND sp.owner_id = auth.uid()
  ));

CREATE POLICY "Customer deletes own taxi"
  ON public.transport_bookings FOR DELETE
  USING (auth.uid() = customer_id);

-- transport_legs policies
CREATE POLICY "Party reads legs"
  ON public.transport_legs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.transport_bookings tb
    WHERE tb.id = transport_legs.booking_id
      AND (tb.customer_id = auth.uid() OR public.is_transport_driver(tb.id))
  ));

CREATE POLICY "Party inserts legs"
  ON public.transport_legs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.transport_bookings tb
    WHERE tb.id = transport_legs.booking_id
      AND (tb.customer_id = auth.uid() OR public.is_transport_driver(tb.id))
  ));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_transport_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_transport_touch
  BEFORE UPDATE ON public.transport_bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_transport_touch();

-- Auto-mirror status to legs + push notifications on driver/customer changes
CREATE OR REPLACE FUNCTION public.tg_transport_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _customer UUID; _driver_owner UUID; _msg TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    INSERT INTO public.transport_legs(booking_id, kind, created_by)
      VALUES (NEW.id, NEW.status, auth.uid());

    SELECT sp.owner_id INTO _driver_owner
      FROM public.service_providers sp WHERE sp.id = NEW.provider_id;
    _customer := NEW.customer_id;

    _msg := CASE NEW.status
      WHEN 'accepted' THEN 'Driver accepted your pet taxi'
      WHEN 'en_route_pickup' THEN 'Driver is on the way to pickup'
      WHEN 'picked_up' THEN 'Pet has been picked up'
      WHEN 'en_route_drop' THEN 'On the way to drop-off'
      WHEN 'dropped_off' THEN 'Pet has been dropped off safely'
      WHEN 'cancelled' THEN 'Pet taxi was cancelled'
      ELSE NULL
    END;

    IF _msg IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, kind, title, body, link)
        VALUES (_customer, 'transport_update', 'Pet taxi update', _msg, '/taxi/' || NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transport_status_change
  AFTER UPDATE ON public.transport_bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_transport_status_change();