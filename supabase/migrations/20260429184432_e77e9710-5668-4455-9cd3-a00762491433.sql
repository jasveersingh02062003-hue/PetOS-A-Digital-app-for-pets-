
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS actor_id uuid;

CREATE INDEX IF NOT EXISTS idx_notifications_actor ON public.notifications(actor_id);

-- Helper that mirrors notify_user but stores the actor.
CREATE OR REPLACE FUNCTION public.notify_user_with_actor(
  _user_id uuid,
  _actor_id uuid,
  _type text,
  _title text,
  _body text,
  _link text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_push boolean;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  -- Don't notify yourself.
  IF _actor_id IS NOT NULL AND _actor_id = _user_id THEN RETURN; END IF;
  SELECT COALESCE((notif_prefs->>'push')::boolean, true) INTO v_push
  FROM public.profiles WHERE id = _user_id;
  IF v_push IS false THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, actor_id, type, title, body, link)
  VALUES (_user_id, _actor_id, _type, _title, _body, _link);
END
$$;

-- Update triggers so they pass the actor through.

CREATE OR REPLACE FUNCTION public.on_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_author uuid;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  IF v_author IS NOT NULL AND v_author <> NEW.author_id THEN
    PERFORM public.notify_user_with_actor(v_author, NEW.author_id, 'post_comment',
      'New comment on your post', LEFT(NEW.body, 80), '/');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.on_new_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_name text;
BEGIN
  SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.follower_id;
  PERFORM public.notify_user_with_actor(NEW.following_id, NEW.follower_id, 'new_follower',
    'New follower',
    COALESCE(v_name, 'Someone') || ' started following you',
    '/u/' || NEW.follower_id);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.on_mating_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_user_with_actor(NEW.to_owner_id, NEW.from_owner_id, 'mate_request',
      'New mating request',
      'Someone is interested in your pet',
      '/mates/manage');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user_with_actor(NEW.from_owner_id, NEW.to_owner_id, 'mate_status',
      'Mating request ' || NEW.status,
      'Status updated for your request',
      '/mates/manage');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.on_rsvp_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_host uuid; v_title text;
BEGIN
  SELECT host_id, title INTO v_host, v_title FROM public.meetups WHERE id = NEW.meetup_id;
  IF v_host IS NOT NULL AND v_host <> NEW.user_id AND NEW.status = 'going' THEN
    PERFORM public.notify_user_with_actor(v_host, NEW.user_id, 'meetup_rsvp',
      'New RSVP for ' || v_title,
      'Someone is coming to your meetup',
      '/meetups/' || NEW.meetup_id);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.on_appointment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_user_with_actor(NEW.vet_id, NEW.owner_id, 'appt_new',
      'New appointment request',
      'Mode: ' || NEW.mode::text || ' on ' || to_char(NEW.scheduled_at, 'DD Mon HH24:MI'),
      '/vet');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user_with_actor(NEW.owner_id, NEW.vet_id, 'appt_status',
      'Appointment ' || NEW.status::text,
      'Update on your appointment',
      '/profile');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.bump_conv_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  INSERT INTO public.notifications (user_id, actor_id, type, title, body, link)
  SELECT cm.user_id, NEW.sender_id, 'new_message',
         'New message',
         LEFT(COALESCE(NEW.body, '[attachment]'), 80),
         '/messages/' || NEW.conversation_id
  FROM public.conversation_members cm
  WHERE cm.conversation_id = NEW.conversation_id
    AND cm.user_id <> NEW.sender_id
    AND cm.muted = false;
  RETURN NEW;
END $$;
