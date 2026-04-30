CREATE OR REPLACE FUNCTION public.on_booking_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_name  text;
  v_title text;
BEGIN
  SELECT owner_id, name INTO v_owner, v_name
  FROM public.service_providers WHERE id = NEW.provider_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_user(
      v_owner,
      'booking_new',
      'New booking request',
      'Someone requested a booking for ' || COALESCE(v_name, 'your service'),
      '/services/manage'
    );

  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- Tailored title so push toasts feel intentional, not robotic.
    v_title := CASE NEW.status::text
      WHEN 'confirmed'   THEN '✅ Booking confirmed'
      WHEN 'in_progress' THEN '🟢 Your provider is on the way'
      WHEN 'completed'   THEN '🎉 Booking completed'
      WHEN 'cancelled'   THEN '⚠️ Booking cancelled'
      WHEN 'declined'    THEN '⚠️ Booking declined'
      ELSE 'Booking ' || NEW.status::text
    END;

    PERFORM public.notify_user(
      NEW.customer_id,
      'booking_status',
      v_title,
      'Your booking with ' || COALESCE(v_name, 'your provider') || ' is now ' || NEW.status::text || '. Tap to track live.',
      '/bookings/' || NEW.id
    );
  END IF;

  RETURN NEW;
END
$function$;