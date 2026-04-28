CREATE TABLE IF NOT EXISTS public.proactive_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES public.pets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  severity SMALLINT NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMPTZ,
  dedupe_key TEXT
);

CREATE INDEX IF NOT EXISTS idx_proactive_alerts_user_active
  ON public.proactive_alerts(user_id, created_at DESC) WHERE dismissed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_proactive_alerts_dedupe
  ON public.proactive_alerts(user_id, pet_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.proactive_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own proactive_alerts"
  ON public.proactive_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owner dismisses own proactive_alerts"
  ON public.proactive_alerts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.proactive_alerts;

SELECT cron.schedule(
  'ai-proactive-scan-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url:='https://pyqudgtmpnxnzzjbcdvc.supabase.co/functions/v1/ai-proactive-scan',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cXVkZ3RtcG54bnp6amJjZHZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODM2MTQsImV4cCI6MjA5Mjk1OTYxNH0.heicqiE_NbcXiKq_7TNoYWhHTdtIB5sksHRq_ln5wNs"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);