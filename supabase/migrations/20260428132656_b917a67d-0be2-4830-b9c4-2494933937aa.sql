-- 1. Tighten error_log RLS: require user_id = auth.uid() (no NULL spam)
DROP POLICY IF EXISTS error_log_insert_any_authed ON public.error_log;
CREATE POLICY error_log_insert_self
  ON public.error_log
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 2. Signup rate-limit table (checked from edge function via service role)
CREATE TABLE IF NOT EXISTS public.signup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL,
  ip_hash text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signup_attempts_email_hash_time_idx
  ON public.signup_attempts (email_hash, attempted_at DESC);
CREATE INDEX IF NOT EXISTS signup_attempts_ip_hash_time_idx
  ON public.signup_attempts (ip_hash, attempted_at DESC);

ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY signup_attempts_admin_select
  ON public.signup_attempts
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE FUNCTION public.purge_old_signup_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.signup_attempts WHERE attempted_at < now() - interval '24 hours';
$$;