-- Phase 6: lightweight first-party analytics
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NULL,                       -- null for anonymous visitors
  session_id  text NULL,                       -- per-tab UUID generated client-side
  event       text NOT NULL,                   -- e.g. 'page_view', 'signup_step', 'post_create'
  route       text NULL,                       -- pathname when fired
  props       jsonb NULL,                      -- arbitrary props, scrubbed of PII client-side
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Hot read paths from the admin dashboard
CREATE INDEX IF NOT EXISTS idx_analytics_event_time
  ON public.analytics_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_time
  ON public.analytics_events (created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert their own event (anon allowed too — needed for signup-funnel tracking)
DROP POLICY IF EXISTS "anyone_insert_own_event" ON public.analytics_events;
CREATE POLICY "anyone_insert_own_event"
  ON public.analytics_events
  FOR INSERT
  TO public
  WITH CHECK (
    user_id IS NULL OR user_id = auth.uid()
  );

-- Only staff/admins read events
DROP POLICY IF EXISTS "staff_read_events" ON public.analytics_events;
CREATE POLICY "staff_read_events"
  ON public.analytics_events
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Lock down the new table from anon SELECT explicitly (defence-in-depth)
REVOKE SELECT ON public.analytics_events FROM anon;
GRANT  INSERT ON public.analytics_events TO anon, authenticated;
GRANT  SELECT ON public.analytics_events TO authenticated;
