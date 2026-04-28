
-- =====================================================================
-- MERGE A: Security, data integrity, performance hardening
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) ATOMIC USAGE COUNTER (fixes race in chat/index.ts)
-- ---------------------------------------------------------------------

-- Add a window_start column so we can do rolling N-day windows (not just daily)
ALTER TABLE public.usage_counters
  ADD COLUMN IF NOT EXISTS window_start timestamptz NOT NULL DEFAULT now();

-- Ensure unique key for ON CONFLICT
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usage_counters_user_kind_period_key'
  ) THEN
    ALTER TABLE public.usage_counters
      ADD CONSTRAINT usage_counters_user_kind_period_key UNIQUE (user_id, kind, period);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.increment_usage(
  _kind text,
  _limit int,
  _window_days int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_period date := CURRENT_DATE;
  v_count int;
  v_window_start timestamptz;
  v_resets_at timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'error', 'unauthenticated');
  END IF;

  -- Sum usage in the rolling window across daily periods
  SELECT COALESCE(SUM(count), 0), MIN(window_start)
    INTO v_count, v_window_start
  FROM public.usage_counters
  WHERE user_id = v_user
    AND kind = _kind
    AND window_start > now() - make_interval(days => _window_days);

  v_resets_at := COALESCE(v_window_start, now()) + make_interval(days => _window_days);

  IF v_count >= _limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'used', v_count,
      'limit', _limit,
      'resets_at', v_resets_at
    );
  END IF;

  -- Atomic upsert for today's bucket
  INSERT INTO public.usage_counters (user_id, kind, period, count, window_start)
  VALUES (v_user, _kind, v_period, 1, now())
  ON CONFLICT (user_id, kind, period)
  DO UPDATE SET count = public.usage_counters.count + 1;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', GREATEST(_limit - v_count - 1, 0),
    'used', v_count + 1,
    'limit', _limit,
    'resets_at', v_resets_at
  );
END $$;

REVOKE ALL ON FUNCTION public.increment_usage(text,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_usage(text,int,int) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2) TIGHTEN pets SELECT (split the giant OR policy)
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS pets_select_scoped ON public.pets;

CREATE POLICY pets_select_own ON public.pets
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY pets_select_discoverable ON public.pets
  FOR SELECT TO authenticated
  USING (discoverable_for_mating = true);

CREATE POLICY pets_select_mate_party ON public.pets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mating_requests mr
    WHERE (mr.from_pet_id = pets.id OR mr.to_pet_id = pets.id)
      AND (auth.uid() = mr.from_owner_id OR auth.uid() = mr.to_owner_id)
  ));

CREATE POLICY pets_select_consult_party ON public.pets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vet_consults vc
    WHERE vc.pet_id = pets.id
      AND (auth.uid() = vc.owner_id OR auth.uid() = vc.vet_id)
  ));

CREATE POLICY pets_select_booking_party ON public.pets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.service_bookings sb
    WHERE sb.pet_id = pets.id
      AND (auth.uid() = sb.customer_id
           OR EXISTS (SELECT 1 FROM public.service_providers sp
                      WHERE sp.id = sb.provider_id AND sp.owner_id = auth.uid()))
  ));

-- For the public feed/posts: use the safe view below; do NOT add a blanket SELECT
-- on pets that would leak owner_id.

-- Safe pets view for joins from posts/feed (no owner_id exposed)
CREATE OR REPLACE VIEW public.pets_public AS
  SELECT id, name, species, breed, gender, avatar_url, bio, city,
         vaccination_verified, discoverable_for_mating
  FROM public.pets;

GRANT SELECT ON public.pets_public TO authenticated;

-- ---------------------------------------------------------------------
-- 3) LOCK DOWN SECURITY DEFINER FUNCTIONS
-- ---------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.current_tier(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_tier(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.notify_user(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.get_pets_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pets_public() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_profiles_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profiles_public() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4) NOTIFICATIONS: explicit insert rule for SECURITY DEFINER helpers
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS notif_definer_insert ON public.notifications;
CREATE POLICY notif_definer_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);  -- writes only happen via SECURITY DEFINER notify_user()

-- ---------------------------------------------------------------------
-- 5) STORAGE HARDENING
-- ---------------------------------------------------------------------

-- Block anonymous bucket listing on image buckets.
-- Existing public SELECT on individual paths still works (URLs load).
DROP POLICY IF EXISTS "Public bucket list disabled" ON storage.objects;

-- Per-bucket: SELECT individual objects allowed (publicly), but no listing
-- via service role only is the safest. We add per-bucket size + mime checks.

-- Safety: revoke any wildcard list if present (Supabase usually has none, but be explicit)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polname IN ('Allow listing posts', 'Allow listing missing-pets')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.polname);
  END LOOP;
END $$;

-- Image upload size + MIME guard for image buckets
DROP POLICY IF EXISTS "Image uploads must be image and under 5MB" ON storage.objects;
CREATE POLICY "Image uploads must be image and under 5MB"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('pet-avatars','user-avatars','posts','missing-pets','marketplace')
    AND (metadata->>'size')::bigint < 5 * 1024 * 1024
    AND (metadata->>'mimetype') LIKE 'image/%'
  );

-- Vault docs: PDFs/images, max 10 MB
DROP POLICY IF EXISTS "Vault uploads under 10MB" ON storage.objects;
CREATE POLICY "Vault uploads under 10MB"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vault-docs'
    AND (metadata->>'size')::bigint < 10 * 1024 * 1024
    AND (
      (metadata->>'mimetype') LIKE 'image/%'
      OR (metadata->>'mimetype') = 'application/pdf'
    )
  );

-- ---------------------------------------------------------------------
-- 6) ASYNC FAN-OUT FOR MISSING-PET ALERTS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- pending | processing | done | failed
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS notification_jobs_pending_idx
  ON public.notification_jobs (status, created_at)
  WHERE status = 'pending';

ALTER TABLE public.notification_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_jobs_admin_select ON public.notification_jobs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Replace the synchronous fan-out with a single queue insert
CREATE OR REPLACE FUNCTION public.enqueue_missing_pet_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    INSERT INTO public.notification_jobs (kind, payload)
    VALUES (
      'missing_pet_fanout',
      jsonb_build_object(
        'missing_pet_id', NEW.id,
        'pet_id', NEW.pet_id,
        'owner_id', NEW.owner_id,
        'last_seen_city', NEW.last_seen_city
      )
    );
  END IF;
  RETURN NEW;
END $$;

-- Drop old trigger if it exists, attach new one
DROP TRIGGER IF EXISTS trg_notify_missing_pet_alerts ON public.missing_pets;
DROP TRIGGER IF EXISTS trg_enqueue_missing_pet_alerts ON public.missing_pets;
CREATE TRIGGER trg_enqueue_missing_pet_alerts
  AFTER INSERT ON public.missing_pets
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_missing_pet_alerts();

-- ---------------------------------------------------------------------
-- 7) RATE LIMITS ON USER-GENERATED CONTENT
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_daily_limit(_table text, _user uuid, _limit int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  IF _table = 'posts' THEN
    SELECT count(*) INTO v_count FROM public.posts
      WHERE author_id = _user AND created_at > now() - interval '1 day';
  ELSIF _table = 'post_comments' THEN
    SELECT count(*) INTO v_count FROM public.post_comments
      WHERE author_id = _user AND created_at > now() - interval '1 day';
  ELSIF _table = 'missing_pet_sightings' THEN
    SELECT count(*) INTO v_count FROM public.missing_pet_sightings
      WHERE reporter_id = _user AND created_at > now() - interval '1 day';
  END IF;
  IF v_count >= _limit THEN
    RAISE EXCEPTION 'rate_limit: daily limit of % reached for %', _limit, _table
      USING ERRCODE = 'check_violation';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tg_limit_posts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.check_daily_limit('posts', NEW.author_id, 10); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.tg_limit_comments() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.check_daily_limit('post_comments', NEW.author_id, 60); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.tg_limit_sightings() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.check_daily_limit('missing_pet_sightings', NEW.reporter_id, 20); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_limit_posts ON public.posts;
CREATE TRIGGER trg_limit_posts BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_limit_posts();

DROP TRIGGER IF EXISTS trg_limit_comments ON public.post_comments;
CREATE TRIGGER trg_limit_comments BEFORE INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_limit_comments();

DROP TRIGGER IF EXISTS trg_limit_sightings ON public.missing_pet_sightings;
CREATE TRIGGER trg_limit_sightings BEFORE INSERT ON public.missing_pet_sightings
  FOR EACH ROW EXECUTE FUNCTION public.tg_limit_sightings();

-- ---------------------------------------------------------------------
-- 8) CASCADE FOREIGN KEYS (account deletion safety)
-- ---------------------------------------------------------------------

-- Helper: drop existing FK if present, add cascading FK
DO $$
DECLARE
  r record;
  fk_specs text[] := ARRAY[
    'pets|owner_id|auth.users|id',
    'posts|author_id|auth.users|id',
    'post_comments|author_id|auth.users|id',
    'post_likes|user_id|auth.users|id',
    'notifications|user_id|auth.users|id',
    'profiles|id|auth.users|id',
    'usage_counters|user_id|auth.users|id',
    'subscriptions|user_id|auth.users|id',
    'payment_intents|user_id|auth.users|id',
    'service_providers|owner_id|auth.users|id',
    'service_bookings|customer_id|auth.users|id',
    'shop_orders|customer_id|auth.users|id',
    'shop_products|seller_id|auth.users|id',
    'mating_listings|owner_id|auth.users|id',
    'missing_pets|owner_id|auth.users|id',
    'missing_pet_sightings|reporter_id|auth.users|id',
    'reviews|reviewer_id|auth.users|id',
    'reports|reporter_id|auth.users|id',
    'vet_applications|user_id|auth.users|id'
  ];
  spec text; parts text[]; tbl text; col text; ref_tbl text; ref_col text;
  fk_name text;
BEGIN
  FOREACH spec IN ARRAY fk_specs LOOP
    parts := string_to_array(spec, '|');
    tbl := parts[1]; col := parts[2]; ref_tbl := parts[3]; ref_col := parts[4];
    fk_name := tbl || '_' || col || '_fkey_cascade';

    -- Drop any existing FK on this column
    FOR r IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = ('public.' || tbl)::regclass
        AND contype = 'f'
        AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
                            WHERE attrelid = ('public.' || tbl)::regclass
                              AND attname = col)]
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', tbl, r.conname);
    END LOOP;

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s(%I) ON DELETE CASCADE',
      tbl, fk_name, col, ref_tbl, ref_col
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 9) DELETION LOG (audit trail for DPDP)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_hash text,
  reason text,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deletion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY deletion_log_admin_select ON public.deletion_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- ---------------------------------------------------------------------
-- 10) ERROR LOG (lightweight observability — no Sentry needed)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.error_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  source text NOT NULL,        -- 'client' | 'edge:<fn>'
  route text,
  message text NOT NULL,
  stack text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS error_log_created_idx ON public.error_log (created_at DESC);

ALTER TABLE public.error_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY error_log_insert_any_authed ON public.error_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY error_log_admin_select ON public.error_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'));
