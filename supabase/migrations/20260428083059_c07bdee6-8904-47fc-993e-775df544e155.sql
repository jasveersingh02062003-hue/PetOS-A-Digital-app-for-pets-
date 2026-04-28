CREATE TABLE IF NOT EXISTS public.cron_health (
  job_name text PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  last_status text NOT NULL DEFAULT 'ok',
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cron_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cron_health_admin_select"
ON public.cron_health
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);
