CREATE OR REPLACE FUNCTION public.notify_org_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved')
     AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      NEW.user_id,
      'org_verified',
      'You''re verified ✓',
      COALESCE(NEW.org_name, 'Your organisation') || ' is now verified. The green tick will appear on your posts and profile.',
      '/profile'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_org_verified ON public.org_profiles;
CREATE TRIGGER trg_notify_org_verified
AFTER INSERT OR UPDATE OF status ON public.org_profiles
FOR EACH ROW
EXECUTE FUNCTION public.notify_org_verified();