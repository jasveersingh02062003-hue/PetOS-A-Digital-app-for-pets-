
-- Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group boolean NOT NULL DEFAULT false,
  title text,
  created_by uuid NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  muted boolean NOT NULL DEFAULT false,
  PRIMARY KEY (conversation_id, user_id)
);
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cm_user ON public.conversation_members(user_id);

-- Helper: is the current user in a conversation?
CREATE OR REPLACE FUNCTION public.is_conversation_member(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = _conv AND user_id = _user);
$$;

CREATE POLICY "conv members read" ON public.conversations FOR SELECT
  USING (public.is_conversation_member(id, auth.uid()));
CREATE POLICY "conv create" ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "conv update by member" ON public.conversations FOR UPDATE
  USING (public.is_conversation_member(id, auth.uid()))
  WITH CHECK (public.is_conversation_member(id, auth.uid()));

CREATE POLICY "cm read own convs" ON public.conversation_members FOR SELECT
  USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "cm insert self or by member" ON public.conversation_members FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "cm update own row" ON public.conversation_members FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "cm leave" ON public.conversation_members FOR DELETE
  USING (user_id = auth.uid());

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  body text,
  attachment_url text,
  attachment_kind text, -- 'image' | 'voice' | 'file'
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_messages_conv_time ON public.messages(conversation_id, created_at DESC);

CREATE POLICY "msg read by member" ON public.messages FOR SELECT
  USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "msg insert by member" ON public.messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "msg edit own" ON public.messages FOR UPDATE
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

-- Bump last_message_at on insert
CREATE OR REPLACE FUNCTION public.bump_conv_last_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  -- notify other members
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT cm.user_id, 'new_message',
         'New message',
         LEFT(COALESCE(NEW.body, '[attachment]'), 80),
         '/messages/' || NEW.conversation_id
  FROM public.conversation_members cm
  WHERE cm.conversation_id = NEW.conversation_id
    AND cm.user_id <> NEW.sender_id
    AND cm.muted = false;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bump_conv ON public.messages;
CREATE TRIGGER trg_bump_conv AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_conv_last_message();

-- Typing indicators (ephemeral table, upsert pattern)
CREATE TABLE IF NOT EXISTS public.typing_indicators (
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "typing read by member" ON public.typing_indicators FOR SELECT
  USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "typing upsert self" ON public.typing_indicators FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "typing update self" ON public.typing_indicators FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "typing delete self" ON public.typing_indicators FOR DELETE
  USING (user_id = auth.uid());

-- Find or create a 1:1 DM
CREATE OR REPLACE FUNCTION public.get_or_create_dm(_other_user uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF v_me = _other_user THEN RAISE EXCEPTION 'cannot_dm_self'; END IF;

  SELECT c.id INTO v_id
  FROM public.conversations c
  WHERE c.is_group = false
    AND EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = c.id AND user_id = v_me)
    AND EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = c.id AND user_id = _other_user)
    AND (SELECT count(*) FROM public.conversation_members WHERE conversation_id = c.id) = 2
  LIMIT 1;

  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO public.conversations (is_group, created_by) VALUES (false, v_me) RETURNING id INTO v_id;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (v_id, v_me), (v_id, _other_user);
  RETURN v_id;
END $$;

-- Mark conversation read
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conv uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.conversation_members SET last_read_at = now()
  WHERE conversation_id = _conv AND user_id = auth.uid();
$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;

-- Add daily.co room columns to appointments (vet video calls)
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS video_provider text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS video_room_token_owner text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS video_room_token_vet text;
