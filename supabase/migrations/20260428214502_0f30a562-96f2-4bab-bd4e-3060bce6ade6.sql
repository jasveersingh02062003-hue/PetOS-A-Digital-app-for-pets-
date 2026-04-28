
-- Phase 20 finish: expire stale paid mating listings.
-- The discovery grid already filters by paid_until > now(), but the
-- "Manage" view still shows active=true. This function flips them off.

CREATE OR REPLACE FUNCTION public.expire_paid_mating_listings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.mating_listings
       SET active = false
     WHERE active = true
       AND paid_until IS NOT NULL
       AND paid_until < now()
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

-- Make sure pg_cron + pg_net are available so the daily schedule (registered
-- separately via the insert tool) can call this function on a timer.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
