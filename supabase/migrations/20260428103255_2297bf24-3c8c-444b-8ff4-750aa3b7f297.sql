
CREATE TYPE public.group_kind AS ENUM ('breed', 'city', 'interest');
CREATE TYPE public.group_member_role AS ENUM ('member', 'mod', 'owner');
CREATE TYPE public.meetup_status AS ENUM ('upcoming', 'cancelled', 'done');
CREATE TYPE public.rsvp_status AS ENUM ('going', 'maybe', 'declined');

CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  kind public.group_kind NOT NULL,
  key text NOT NULL,
  description text,
  cover_url text,
  member_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, key)
);
CREATE INDEX idx_groups_kind_key ON public.groups(kind, key);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY groups_select_all ON public.groups FOR SELECT TO authenticated USING (true);
CREATE POLICY groups_insert_authed ON public.groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY groups_update_owner ON public.groups FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY groups_delete_owner ON public.groups FOR DELETE TO authenticated USING (auth.uid() = created_by);
CREATE TRIGGER trg_groups_updated BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.group_member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX idx_group_members_user ON public.group_members(user_id);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY gm_select_all ON public.group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY gm_insert_self ON public.group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY gm_delete_self_or_owner ON public.group_members FOR DELETE TO authenticated USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid())
);

CREATE OR REPLACE FUNCTION public.bump_group_member_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.groups SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.group_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_gm_count_ins AFTER INSERT ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.bump_group_member_count();
CREATE TRIGGER trg_gm_count_del AFTER DELETE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.bump_group_member_count();

CREATE TABLE public.group_posts (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  added_by uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, post_id)
);
CREATE INDEX idx_group_posts_post ON public.group_posts(post_id);
ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY gp_select_all ON public.group_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY gp_insert_author ON public.group_posts FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = added_by AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid())
);
CREATE POLICY gp_delete_author ON public.group_posts FOR DELETE TO authenticated USING (auth.uid() = added_by);

CREATE TABLE public.meetups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  city text,
  venue text,
  lat numeric,
  lng numeric,
  starts_at timestamptz NOT NULL,
  capacity integer,
  cover_url text,
  status public.meetup_status NOT NULL DEFAULT 'upcoming',
  attending_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_meetups_starts_at ON public.meetups(starts_at);
CREATE INDEX idx_meetups_city ON public.meetups(city);
CREATE INDEX idx_meetups_group ON public.meetups(group_id);
ALTER TABLE public.meetups ENABLE ROW LEVEL SECURITY;
CREATE POLICY meetups_select_all ON public.meetups FOR SELECT TO authenticated USING (true);
CREATE POLICY meetups_insert_host ON public.meetups FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY meetups_update_host ON public.meetups FOR UPDATE TO authenticated USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);
CREATE POLICY meetups_delete_host ON public.meetups FOR DELETE TO authenticated USING (auth.uid() = host_id);
CREATE TRIGGER trg_meetups_updated BEFORE UPDATE ON public.meetups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.meetup_rsvps (
  meetup_id uuid NOT NULL REFERENCES public.meetups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  pet_id uuid,
  status public.rsvp_status NOT NULL DEFAULT 'going',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meetup_id, user_id)
);
CREATE INDEX idx_rsvps_user ON public.meetup_rsvps(user_id);
ALTER TABLE public.meetup_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY rsvps_select_all ON public.meetup_rsvps FOR SELECT TO authenticated USING (true);
CREATE POLICY rsvps_insert_self ON public.meetup_rsvps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY rsvps_update_self ON public.meetup_rsvps FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY rsvps_delete_self ON public.meetup_rsvps FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.recount_meetup_attending()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  v_id := COALESCE(NEW.meetup_id, OLD.meetup_id);
  UPDATE public.meetups
  SET attending_count = (SELECT count(*) FROM public.meetup_rsvps WHERE meetup_id = v_id AND status = 'going')
  WHERE id = v_id;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_rsvps_count_ins AFTER INSERT ON public.meetup_rsvps FOR EACH ROW EXECUTE FUNCTION public.recount_meetup_attending();
CREATE TRIGGER trg_rsvps_count_upd AFTER UPDATE ON public.meetup_rsvps FOR EACH ROW EXECUTE FUNCTION public.recount_meetup_attending();
CREATE TRIGGER trg_rsvps_count_del AFTER DELETE ON public.meetup_rsvps FOR EACH ROW EXECUTE FUNCTION public.recount_meetup_attending();
CREATE TRIGGER trg_rsvps_updated BEFORE UPDATE ON public.meetup_rsvps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.on_rsvp_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_host uuid; v_title text;
BEGIN
  SELECT host_id, title INTO v_host, v_title FROM public.meetups WHERE id = NEW.meetup_id;
  IF v_host IS NOT NULL AND v_host <> NEW.user_id AND NEW.status = 'going' THEN
    PERFORM public.notify_user(v_host, 'meetup_rsvp', 'New RSVP for ' || v_title, 'Someone is coming to your meetup', '/meetups/' || NEW.meetup_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_rsvp_notify AFTER INSERT ON public.meetup_rsvps FOR EACH ROW EXECUTE FUNCTION public.on_rsvp_insert();

INSERT INTO public.groups (slug, name, kind, key, description) VALUES
  ('breed-golden-retriever', 'Golden Retrievers', 'breed', 'golden_retriever', 'For everyone with a Golden in their life.'),
  ('breed-labrador', 'Labrador Lovers', 'breed', 'labrador', 'Labradors of every shade welcome.'),
  ('breed-german-shepherd', 'German Shepherds', 'breed', 'german_shepherd', 'Smart, loyal, and loved.'),
  ('breed-beagle', 'Beagle Pack', 'breed', 'beagle', 'Sniffers united.'),
  ('breed-pug', 'Pug Life', 'breed', 'pug', 'For the snorters and the cuddlers.'),
  ('breed-shih-tzu', 'Shih Tzu Squad', 'breed', 'shih_tzu', 'Tiny royalty.'),
  ('breed-pomeranian', 'Pomeranian Posse', 'breed', 'pomeranian', 'Floof appreciation only.'),
  ('breed-indie', 'Indie Dogs of India', 'breed', 'indie', 'Celebrating our incredible street dogs.'),
  ('breed-persian-cat', 'Persian Cats', 'breed', 'persian_cat', 'Long-haired beauties.'),
  ('breed-ragdoll', 'Ragdoll Cats', 'breed', 'ragdoll', 'Floppy purrballs.'),
  ('city-bengaluru', 'Bengaluru Pet Parents', 'city', 'bengaluru', 'Meetups, vets, parks — all in BLR.'),
  ('city-mumbai', 'Mumbai Pet Parents', 'city', 'mumbai', 'For pets and people in Mumbai.'),
  ('city-delhi', 'Delhi NCR Pets', 'city', 'delhi', 'Across NCR — meet, play, share.'),
  ('city-hyderabad', 'Hyderabad Pets', 'city', 'hyderabad', 'Hi-tech city, happy pets.'),
  ('city-chennai', 'Chennai Pets', 'city', 'chennai', 'Madras pet parent meetups.'),
  ('city-pune', 'Pune Pets', 'city', 'pune', 'Walks, vets, and weekend meetups.'),
  ('city-kolkata', 'Kolkata Pets', 'city', 'kolkata', 'For pet parents in the City of Joy.'),
  ('city-ahmedabad', 'Ahmedabad Pets', 'city', 'ahmedabad', 'Gujarat pet community.'),
  ('city-jaipur', 'Jaipur Pets', 'city', 'jaipur', 'Pink City pet parents.'),
  ('city-goa', 'Goa Pets', 'city', 'goa', 'Beach dogs and beyond.'),
  ('interest-puppy-training', 'Puppy Training 101', 'interest', 'puppy_training', 'Tips, tricks, and shared wins.'),
  ('interest-raw-feeding', 'Raw & Fresh Feeding', 'interest', 'raw_feeding', 'Recipes, sources, science.'),
  ('interest-adoption', 'Adopt Don''t Shop', 'interest', 'adoption', 'Rescues and rehoming.'),
  ('interest-senior-care', 'Senior Pet Care', 'interest', 'senior_care', 'Loving our greying companions.'),
  ('interest-dog-sports', 'Dog Sports & Agility', 'interest', 'dog_sports', 'Flyball, agility, frisbee.'),
  ('interest-grooming-diy', 'DIY Grooming', 'interest', 'grooming_diy', 'Brushes, baths, and trims at home.'),
  ('interest-travel', 'Travel With Pets', 'interest', 'travel', 'Pet-friendly stays and tips.'),
  ('interest-photography', 'Pet Photography', 'interest', 'photography', 'Capture the cuteness.'),
  ('interest-anxiety', 'Anxiety & Behaviour', 'interest', 'anxiety', 'Support for reactive and anxious pets.'),
  ('interest-cat-enrichment', 'Cat Behaviour & Enrichment', 'interest', 'cat_enrichment', 'Toys, puzzles, climbing setups.');
