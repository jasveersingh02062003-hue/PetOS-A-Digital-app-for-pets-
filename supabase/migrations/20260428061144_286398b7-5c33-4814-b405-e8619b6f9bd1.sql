CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_own_select ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY notif_own_update ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY notif_own_delete ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_notif_user_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notif_user_recent ON public.notifications(user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Generic helper
CREATE OR REPLACE FUNCTION public.notify_user(_user_id uuid, _type text, _title text, _body text, _link text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (_user_id, _type, _title, _body, _link);
END $$;
REVOKE ALL ON FUNCTION public.notify_user(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;

-- Bookings
CREATE OR REPLACE FUNCTION public.on_booking_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_owner uuid; v_name text;
BEGIN
  SELECT owner_id, name INTO v_owner, v_name FROM public.service_providers WHERE id = NEW.provider_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_user(v_owner, 'booking_new',
      'New booking request',
      'Someone requested a booking for ' || v_name,
      '/services/manage');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(NEW.customer_id, 'booking_status',
      'Booking ' || NEW.status,
      'Your booking with ' || v_name || ' is now ' || NEW.status,
      '/services/manage');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_booking_event() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_booking_notify AFTER INSERT OR UPDATE ON public.service_bookings
  FOR EACH ROW EXECUTE FUNCTION public.on_booking_event();

-- Orders: notify each unique seller on new order
CREATE OR REPLACE FUNCTION public.on_order_item_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_user(NEW.seller_id, 'order_new',
    'New order received',
    'You have a new order for ' || NEW.title_snapshot,
    '/services/manage');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_order_item_insert() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_order_item_notify AFTER INSERT ON public.shop_order_items
  FOR EACH ROW EXECUTE FUNCTION public.on_order_item_insert();

CREATE OR REPLACE FUNCTION public.on_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(NEW.customer_id, 'order_status',
      'Order ' || NEW.status,
      'Your order is now ' || NEW.status,
      '/orders');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_order_status() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_order_status_notify AFTER UPDATE ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.on_order_status();

-- Mating requests
CREATE OR REPLACE FUNCTION public.on_mating_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_user(NEW.to_owner_id, 'mate_request',
      'New mating request',
      'Someone is interested in your pet',
      '/mates/manage');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(NEW.from_owner_id, 'mate_status',
      'Mating request ' || NEW.status,
      'Status updated for your request',
      '/mates/manage');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_mating_request() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_mate_req_notify AFTER INSERT OR UPDATE ON public.mating_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_mating_request();

-- Vet consults
CREATE OR REPLACE FUNCTION public.on_consult_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(NEW.owner_id, 'consult_status',
      'Vet consult ' || replace(NEW.status::text,'_',' '),
      'Update on your tele-vet consult',
      '/vet/consult/' || NEW.id);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_consult_event() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_consult_notify AFTER UPDATE ON public.vet_consults
  FOR EACH ROW EXECUTE FUNCTION public.on_consult_event();

-- Likes & comments on posts
CREATE OR REPLACE FUNCTION public.on_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_author uuid;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
    PERFORM public.notify_user(v_author, 'post_like',
      'Someone liked your post', NULL, '/');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_post_like() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_post_like_notify AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.on_post_like();

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
    PERFORM public.notify_user(v_author, 'post_comment',
      'New comment on your post', LEFT(NEW.body, 80), '/');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_post_comment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_post_comment_notify AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.on_post_comment();