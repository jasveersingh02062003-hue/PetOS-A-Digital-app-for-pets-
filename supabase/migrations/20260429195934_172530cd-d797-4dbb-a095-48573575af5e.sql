
-- Pet skills (trick repertoire per pet)
CREATE TABLE public.pet_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  name text NOT NULL,
  taught_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pet_id, name)
);
ALTER TABLE public.pet_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pet skills are public readable"
  ON public.pet_skills FOR SELECT USING (true);

CREATE POLICY "Pet owner can insert skills"
  ON public.pet_skills FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()));

CREATE POLICY "Pet owner can delete skills"
  ON public.pet_skills FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()));

-- Skill spotlights (a post showcasing a skill)
CREATE TABLE public.skill_spotlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.pet_skills(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  video_url text,
  caption text,
  vouch_count int NOT NULL DEFAULT 0,
  wow_count int NOT NULL DEFAULT 0,
  crowd_favourite_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.skill_spotlights ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_spotlights_pet ON public.skill_spotlights(pet_id);
CREATE INDEX idx_spotlights_post ON public.skill_spotlights(post_id);

CREATE POLICY "Spotlights public readable"
  ON public.skill_spotlights FOR SELECT USING (true);

CREATE POLICY "Pet owner can create spotlight"
  ON public.skill_spotlights FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid())
  );

CREATE POLICY "Pet owner can delete spotlight"
  ON public.skill_spotlights FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()));

-- Vouches
CREATE TABLE public.skill_vouches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spotlight_id uuid NOT NULL REFERENCES public.skill_spotlights(id) ON DELETE CASCADE,
  voucher_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (spotlight_id, voucher_id)
);
ALTER TABLE public.skill_vouches ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_vouches_spotlight ON public.skill_vouches(spotlight_id);

CREATE POLICY "Vouches public readable"
  ON public.skill_vouches FOR SELECT USING (true);

CREATE POLICY "Authed users can vouch (not self)"
  ON public.skill_vouches FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = voucher_id
    AND NOT EXISTS (
      SELECT 1 FROM public.skill_spotlights s
      JOIN public.pets p ON p.id = s.pet_id
      WHERE s.id = spotlight_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove own vouch"
  ON public.skill_vouches FOR DELETE TO authenticated
  USING (auth.uid() = voucher_id);

-- Maintain vouch_count + crowd_favourite flip
CREATE OR REPLACE FUNCTION public.maintain_vouch_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_count int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.skill_spotlights
       SET vouch_count = vouch_count + 1,
           crowd_favourite_at = CASE
             WHEN vouch_count + 1 >= 50 AND crowd_favourite_at IS NULL THEN now()
             ELSE crowd_favourite_at
           END
     WHERE id = NEW.spotlight_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.skill_spotlights
       SET vouch_count = GREATEST(vouch_count - 1, 0)
     WHERE id = OLD.spotlight_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_vouch_count_ins
  AFTER INSERT ON public.skill_vouches
  FOR EACH ROW EXECUTE FUNCTION public.maintain_vouch_count();

CREATE TRIGGER trg_vouch_count_del
  AFTER DELETE ON public.skill_vouches
  FOR EACH ROW EXECUTE FUNCTION public.maintain_vouch_count();

-- Link posts to a spotlight (so feed can render the orange ribbon)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS skill_spotlight_id uuid REFERENCES public.skill_spotlights(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_posts_skill_spotlight ON public.posts(skill_spotlight_id);
