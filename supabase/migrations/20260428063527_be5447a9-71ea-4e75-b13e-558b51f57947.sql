
-- Reports table for moderation queue
CREATE TYPE public.report_subject AS ENUM ('post','comment','product','provider','user','listing');
CREATE TYPE public.report_status AS ENUM ('open','reviewing','resolved','dismissed');

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  subject_type report_subject NOT NULL,
  subject_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status report_status NOT NULL DEFAULT 'open',
  resolver_id uuid,
  resolver_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY reports_insert_own ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY reports_select_own_or_admin ON public.reports
  FOR SELECT TO authenticated
  USING (
    auth.uid() = reporter_id
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'moderator')
  );

CREATE POLICY reports_admin_update ON public.reports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator'));

CREATE TRIGGER reports_set_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_reports_status ON public.reports(status, created_at DESC);
CREATE INDEX idx_reports_subject ON public.reports(subject_type, subject_id);
