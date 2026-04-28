
-- Blocked users
CREATE TABLE IF NOT EXISTS public.blocked_users (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_blocked ON public.blocked_users(blocked_id);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_select_own" ON public.blocked_users FOR SELECT
  USING (auth.uid() = blocker_id);
CREATE POLICY "block_insert_own" ON public.blocked_users FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "block_delete_own" ON public.blocked_users FOR DELETE
  USING (auth.uid() = blocker_id);

-- Helper
CREATE OR REPLACE FUNCTION public.is_blocked(_blocker uuid, _blocked uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE blocker_id = _blocker AND blocked_id = _blocked
  );
$$;

-- Content moderation audit log
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mod_verdict') THEN
    CREATE TYPE public.mod_verdict AS ENUM ('allow', 'flag', 'block');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.content_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content_type text NOT NULL,           -- 'post' | 'comment' | 'message' | 'profile_bio'
  content_id uuid,
  excerpt text,
  verdict public.mod_verdict NOT NULL,
  reasons text[] NOT NULL DEFAULT '{}',
  score numeric,
  source text NOT NULL DEFAULT 'auto',  -- 'auto' | 'manual' | 'banned_word'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modlog_author ON public.content_moderation_log(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_modlog_verdict ON public.content_moderation_log(verdict, created_at DESC);

ALTER TABLE public.content_moderation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modlog_admin_read" ON public.content_moderation_log FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'));

-- No public insert; only edge functions (service role) write to this table.
