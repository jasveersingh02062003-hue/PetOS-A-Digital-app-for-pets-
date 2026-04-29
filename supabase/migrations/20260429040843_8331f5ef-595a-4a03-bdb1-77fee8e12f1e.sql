CREATE OR REPLACE FUNCTION public.tg_transport_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _msg TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    INSERT INTO public.transport_legs(booking_id, kind, created_by)
      VALUES (NEW.id, NEW.status, auth.uid());

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
      INSERT INTO public.notifications(user_id, type, title, body, link)
        VALUES (NEW.customer_id, 'transport_update', 'Pet taxi update', _msg, '/taxi/' || NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;