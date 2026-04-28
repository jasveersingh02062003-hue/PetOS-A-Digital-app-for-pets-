
-- Remove any prior schedule with this name
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'drain-notification-jobs';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

SELECT cron.schedule(
  'drain-notification-jobs',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://fappyyhsdmybkyrhyutm.supabase.co/functions/v1/process-notification-jobs',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhcHB5eWhzZG15Ymt5cmh5dXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDgwNTIsImV4cCI6MjA5MjkyNDA1Mn0.B8mZ31CJzSouxzVKY777dHjT_lz_k_yCikOdrUvjs7g"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
