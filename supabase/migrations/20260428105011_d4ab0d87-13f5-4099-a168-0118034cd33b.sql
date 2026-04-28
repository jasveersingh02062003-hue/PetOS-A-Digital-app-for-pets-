SELECT cron.schedule(
  'drop-daily-prompt-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://fappyyhsdmybkyrhyutm.supabase.co/functions/v1/drop-daily-prompt',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhcHB5eWhzZG15Ymt5cmh5dXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDgwNTIsImV4cCI6MjA5MjkyNDA1Mn0.B8mZ31CJzSouxzVKY777dHjT_lz_k_yCikOdrUvjs7g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);