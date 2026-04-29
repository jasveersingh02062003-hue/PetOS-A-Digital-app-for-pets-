CREATE OR REPLACE FUNCTION public.enqueue_missing_pet_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    INSERT INTO public.notification_jobs (kind, payload)
    VALUES (
      'missing_pet_fanout',
      jsonb_build_object(
        'missing_pet_id', NEW.id,
        'pet_id', NEW.pet_id,
        'owner_id', NEW.owner_id,
        'last_seen_city', NEW.last_seen_city,
        'last_seen_lat', NEW.last_seen_lat,
        'last_seen_lng', NEW.last_seen_lng,
        'radius_km', 15
      )
    );
  END IF;
  RETURN NEW;
END $$;