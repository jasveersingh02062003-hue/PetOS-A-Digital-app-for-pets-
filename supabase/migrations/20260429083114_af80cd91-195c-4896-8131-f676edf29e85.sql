
-- 1. service_providers: extend
ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS service_radius_km int NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS days_available text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS time_slots text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS accepting_jobs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric;

ALTER TABLE public.service_providers
  DROP CONSTRAINT IF EXISTS service_providers_verification_status_check;
ALTER TABLE public.service_providers
  ADD CONSTRAINT service_providers_verification_status_check
  CHECK (verification_status IN ('pending','approved','rejected'));

CREATE INDEX IF NOT EXISTS idx_providers_accepting
  ON public.service_providers(category, accepting_jobs)
  WHERE accepting_jobs AND verified;
CREATE INDEX IF NOT EXISTS idx_providers_geo
  ON public.service_providers(lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Helper: is this user an admin/moderator?
CREATE OR REPLACE FUNCTION public.is_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'super_admin'::public.app_role)
      OR public.has_role(_uid, 'moderator'::public.app_role);
$$;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

-- 2. provider_documents
CREATE TABLE IF NOT EXISTS public.provider_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('govt_id','address','cert','license','other')),
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_provider_docs_provider ON public.provider_documents(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_docs_status   ON public.provider_documents(status);

ALTER TABLE public.provider_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY provider_docs_select ON public.provider_documents
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY provider_docs_insert ON public.provider_documents
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY provider_docs_update ON public.provider_documents
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY provider_docs_delete ON public.provider_documents
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TRIGGER trg_provider_docs_updated
  BEFORE UPDATE ON public.provider_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('provider-docs', 'provider-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "provider-docs read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'provider-docs'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_staff(auth.uid()))
  );
CREATE POLICY "provider-docs write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'provider-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "provider-docs delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'provider-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 3. job_posts
CREATE TABLE IF NOT EXISTS public.job_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  category public.service_category NOT NULL,
  title text NOT NULL,
  description text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60,
  address text,
  lat numeric,
  lng numeric,
  budget_inr int,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','assigned','completed','cancelled')),
  assigned_provider_id uuid REFERENCES public.service_providers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_open ON public.job_posts(category, status, scheduled_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_jobs_owner ON public.job_posts(owner_id);

ALTER TABLE public.job_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY jobs_select ON public.job_posts
  FOR SELECT TO authenticated
  USING (
    status = 'open'
    OR owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.service_providers sp
               WHERE sp.id = job_posts.assigned_provider_id AND sp.owner_id = auth.uid())
    OR public.is_staff(auth.uid())
  );
CREATE POLICY jobs_insert ON public.job_posts
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY jobs_update ON public.job_posts
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY jobs_delete ON public.job_posts
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TRIGGER trg_jobs_updated
  BEFORE UPDATE ON public.job_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. job_offers
CREATE TABLE IF NOT EXISTS public.job_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_posts(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  provider_owner_id uuid NOT NULL,
  message text,
  price_inr int,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, provider_id)
);
CREATE INDEX IF NOT EXISTS idx_job_offers_job ON public.job_offers(job_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_provider ON public.job_offers(provider_id);

ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_offers_select ON public.job_offers
  FOR SELECT TO authenticated
  USING (
    provider_owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.job_posts j WHERE j.id = job_offers.job_id AND j.owner_id = auth.uid())
    OR public.is_staff(auth.uid())
  );
CREATE POLICY job_offers_insert ON public.job_offers
  FOR INSERT TO authenticated WITH CHECK (provider_owner_id = auth.uid());
CREATE POLICY job_offers_update ON public.job_offers
  FOR UPDATE TO authenticated
  USING (
    provider_owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.job_posts j WHERE j.id = job_offers.job_id AND j.owner_id = auth.uid())
  )
  WITH CHECK (
    provider_owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.job_posts j WHERE j.id = job_offers.job_id AND j.owner_id = auth.uid())
  );

CREATE TRIGGER trg_job_offers_updated
  BEFORE UPDATE ON public.job_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. notification_preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY,
  push  boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT true,
  per_kind jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_pref_select ON public.notification_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notif_pref_insert ON public.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY notif_pref_update ON public.notification_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_notif_pref_updated
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6a. enqueue fan-out on new job
CREATE OR REPLACE FUNCTION public.tg_enqueue_job_fanout()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'open' THEN
    INSERT INTO public.notification_jobs (kind, payload)
    VALUES ('job_fanout', jsonb_build_object('job_id', NEW.id));
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.tg_enqueue_job_fanout() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_job_post_fanout ON public.job_posts;
CREATE TRIGGER trg_job_post_fanout
  AFTER INSERT ON public.job_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_enqueue_job_fanout();

-- 6b. notify owner when an offer arrives
CREATE OR REPLACE FUNCTION public.tg_notify_job_offer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_title text;
BEGIN
  SELECT owner_id, title INTO v_owner, v_title FROM public.job_posts WHERE id = NEW.job_id;
  IF v_owner IS NOT NULL THEN
    PERFORM public.notify_user(v_owner,'job_offer_received','New offer on your job',
      COALESCE(v_title,'Someone wants to help'),'/jobs/'||NEW.job_id);
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.tg_notify_job_offer() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_job_offer_notify ON public.job_offers;
CREATE TRIGGER trg_job_offer_notify
  AFTER INSERT ON public.job_offers
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_job_offer();

-- 6c. on assignment: notify chosen, decline others
CREATE OR REPLACE FUNCTION public.tg_on_job_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_provider_owner uuid;
BEGIN
  IF NEW.status = 'assigned'
     AND COALESCE(OLD.status,'') <> 'assigned'
     AND NEW.assigned_provider_id IS NOT NULL THEN
    SELECT owner_id INTO v_provider_owner FROM public.service_providers WHERE id = NEW.assigned_provider_id;
    IF v_provider_owner IS NOT NULL THEN
      PERFORM public.notify_user(v_provider_owner,'job_accepted','Job confirmed',
        COALESCE(NEW.title,'Your offer was accepted'),'/jobs/'||NEW.id);
    END IF;
    UPDATE public.job_offers SET status='declined'
      WHERE job_id = NEW.id AND provider_id <> NEW.assigned_provider_id AND status='pending';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.tg_on_job_assigned() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_job_assigned ON public.job_posts;
CREATE TRIGGER trg_job_assigned
  AFTER UPDATE OF status ON public.job_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_on_job_assigned();

-- 6d. notify provider on verification status change
CREATE OR REPLACE FUNCTION public.tg_notify_provider_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF NEW.verification_status = 'approved' THEN
      PERFORM public.notify_user(NEW.owner_id,'verification_approved','You are verified',
        'Your provider profile has been approved. You can now accept jobs.','/provider');
    ELSIF NEW.verification_status = 'rejected' THEN
      PERFORM public.notify_user(NEW.owner_id,'verification_rejected','Verification needs attention',
        COALESCE(NEW.verification_notes,'Please review and re-submit your documents.'),'/provider');
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.tg_notify_provider_verification() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_provider_verification_notify ON public.service_providers;
CREATE TRIGGER trg_provider_verification_notify
  AFTER UPDATE OF verification_status ON public.service_providers
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_provider_verification();
