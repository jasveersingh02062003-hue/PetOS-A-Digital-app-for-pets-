
CREATE TYPE public.vet_q_status AS ENUM ('open', 'answered', 'closed');
CREATE TYPE public.vet_q_category AS ENUM ('behavior', 'nutrition', 'medical', 'training', 'other');

CREATE TABLE public.vet_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asker_id uuid NOT NULL,
  pet_id uuid,
  title text NOT NULL,
  body text NOT NULL,
  species text,
  category public.vet_q_category NOT NULL DEFAULT 'other',
  photo_urls text[] NOT NULL DEFAULT '{}',
  status public.vet_q_status NOT NULL DEFAULT 'open',
  best_answer_id uuid,
  view_count integer NOT NULL DEFAULT 0,
  answer_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vetq_created ON public.vet_questions(created_at DESC);
CREATE INDEX idx_vetq_category ON public.vet_questions(category);
CREATE INDEX idx_vetq_status ON public.vet_questions(status);
ALTER TABLE public.vet_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY vetq_select_all ON public.vet_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY vetq_insert_self ON public.vet_questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = asker_id);
CREATE POLICY vetq_update_asker ON public.vet_questions FOR UPDATE TO authenticated USING (auth.uid() = asker_id) WITH CHECK (auth.uid() = asker_id);
CREATE POLICY vetq_delete_asker ON public.vet_questions FOR DELETE TO authenticated USING (auth.uid() = asker_id);
CREATE TRIGGER trg_vetq_updated BEFORE UPDATE ON public.vet_questions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.vet_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.vet_questions(id) ON DELETE CASCADE,
  vet_id uuid NOT NULL,
  body text NOT NULL,
  helpful_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vetans_question ON public.vet_answers(question_id);
CREATE INDEX idx_vetans_vet ON public.vet_answers(vet_id);
ALTER TABLE public.vet_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY vetans_select_all ON public.vet_answers FOR SELECT TO authenticated USING (true);
CREATE POLICY vetans_insert_vet ON public.vet_answers FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = vet_id AND public.has_role(auth.uid(), 'vet')
);
CREATE POLICY vetans_update_own ON public.vet_answers FOR UPDATE TO authenticated USING (auth.uid() = vet_id) WITH CHECK (auth.uid() = vet_id);
CREATE POLICY vetans_delete_own ON public.vet_answers FOR DELETE TO authenticated USING (auth.uid() = vet_id);
CREATE TRIGGER trg_vetans_updated BEFORE UPDATE ON public.vet_answers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.vet_answer_helpful (
  answer_id uuid NOT NULL REFERENCES public.vet_answers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (answer_id, user_id)
);
ALTER TABLE public.vet_answer_helpful ENABLE ROW LEVEL SECURITY;
CREATE POLICY vah_select_all ON public.vet_answer_helpful FOR SELECT TO authenticated USING (true);
CREATE POLICY vah_insert_self ON public.vet_answer_helpful FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY vah_delete_self ON public.vet_answer_helpful FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Helpful count + answer count + helpful_vet badge
CREATE OR REPLACE FUNCTION public.bump_answer_helpful()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vet uuid; v_count int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.vet_answers SET helpful_count = helpful_count + 1 WHERE id = NEW.answer_id
      RETURNING vet_id, helpful_count INTO v_vet, v_count;
    -- Award helpful_vet badge every 10 helpfuls
    IF v_count IN (10, 50, 100) THEN
      INSERT INTO public.achievements (user_id, kind) VALUES (v_vet, 'helpful_vet')
      ON CONFLICT (user_id, pet_id, kind) DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.vet_answers SET helpful_count = GREATEST(helpful_count - 1, 0) WHERE id = OLD.answer_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_vah_ins AFTER INSERT ON public.vet_answer_helpful FOR EACH ROW EXECUTE FUNCTION public.bump_answer_helpful();
CREATE TRIGGER trg_vah_del AFTER DELETE ON public.vet_answer_helpful FOR EACH ROW EXECUTE FUNCTION public.bump_answer_helpful();

-- Notify asker, bump answer count, mark question answered
CREATE OR REPLACE FUNCTION public.on_vet_answer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_asker uuid; v_title text;
BEGIN
  UPDATE public.vet_questions
    SET answer_count = answer_count + 1,
        status = CASE WHEN status = 'open' THEN 'answered'::vet_q_status ELSE status END
    WHERE id = NEW.question_id
    RETURNING asker_id, title INTO v_asker, v_title;
  IF v_asker IS NOT NULL AND v_asker <> NEW.vet_id THEN
    PERFORM public.notify_user(v_asker, 'vet_answer',
      'A vet answered your question',
      LEFT(NEW.body, 80),
      '/askvet/' || NEW.question_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_vetans_after_insert AFTER INSERT ON public.vet_answers FOR EACH ROW EXECUTE FUNCTION public.on_vet_answer();

-- ============================================================
-- New badges: vaccinated, dewormed_recent, meetup_host, social_butterfly
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_vaccinated_badge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.vaccination_verified = true AND COALESCE(OLD.vaccination_verified, false) = false THEN
    INSERT INTO public.achievements (user_id, pet_id, kind) VALUES (NEW.owner_id, NEW.id, 'vaccinated')
    ON CONFLICT (user_id, pet_id, kind) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pets_vaccinated AFTER UPDATE ON public.pets FOR EACH ROW EXECUTE FUNCTION public.award_vaccinated_badge();

CREATE OR REPLACE FUNCTION public.award_dewormed_badge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT owner_id INTO v_owner FROM public.pets WHERE id = NEW.pet_id;
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.achievements (user_id, pet_id, kind) VALUES (v_owner, NEW.pet_id, 'dewormed_recent')
    ON CONFLICT (user_id, pet_id, kind) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_parasite_dewormed AFTER INSERT ON public.parasite_preventatives FOR EACH ROW EXECUTE FUNCTION public.award_dewormed_badge();

CREATE OR REPLACE FUNCTION public.award_meetup_host_badge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.achievements (user_id, kind) VALUES (NEW.host_id, 'meetup_host')
  ON CONFLICT (user_id, pet_id, kind) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_meetup_host_badge AFTER INSERT ON public.meetups FOR EACH ROW EXECUTE FUNCTION public.award_meetup_host_badge();

CREATE OR REPLACE FUNCTION public.award_social_butterfly_badge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NEW.status = 'going' THEN
    SELECT count(*) INTO v_count FROM public.meetup_rsvps WHERE user_id = NEW.user_id AND status = 'going';
    IF v_count >= 3 THEN
      INSERT INTO public.achievements (user_id, kind) VALUES (NEW.user_id, 'social_butterfly')
      ON CONFLICT (user_id, pet_id, kind) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_social_butterfly AFTER INSERT ON public.meetup_rsvps FOR EACH ROW EXECUTE FUNCTION public.award_social_butterfly_badge();
