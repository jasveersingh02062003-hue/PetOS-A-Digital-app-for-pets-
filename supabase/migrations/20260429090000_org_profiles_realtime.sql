-- Enable realtime for org_profiles so the verified tick auto-flips when an admin approves an org.
ALTER TABLE public.org_profiles REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.org_profiles;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
