CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.breed_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  species TEXT NOT NULL,
  breed TEXT NOT NULL,
  origin TEXT,
  temperament TEXT[] DEFAULT '{}',
  climate_fit TEXT[] DEFAULT '{}',
  climate_warnings TEXT,
  monthly_cost_min INT,
  monthly_cost_max INT,
  exercise_hours_per_day NUMERIC(3,1),
  experience_level TEXT,
  good_with_kids BOOLEAN,
  good_with_other_pets BOOLEAN,
  apartment_friendly BOOLEAN,
  noise_level TEXT,
  shedding TEXT,
  grooming_needs TEXT,
  lifespan_years_min INT,
  lifespan_years_max INT,
  common_health_issues TEXT[] DEFAULT '{}',
  pure_breed_traits TEXT,
  fake_breeder_warnings TEXT,
  short_summary TEXT,
  long_description TEXT,
  india_notes TEXT,
  image_url TEXT,
  popularity INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (species, breed)
);
CREATE INDEX idx_breed_profiles_species ON public.breed_profiles(species);
CREATE INDEX idx_breed_profiles_popularity ON public.breed_profiles(popularity DESC);
ALTER TABLE public.breed_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Breed profiles viewable by everyone" ON public.breed_profiles FOR SELECT USING (true);
CREATE POLICY "Super admins manage breed profiles" ON public.breed_profiles FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.breed_quiz_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  recommended_breeds JSONB DEFAULT '[]',
  avoid_breeds JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_breed_quiz_responses_user ON public.breed_quiz_responses(user_id, created_at DESC);
ALTER TABLE public.breed_quiz_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own quiz responses" ON public.breed_quiz_responses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own quiz responses" ON public.breed_quiz_responses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.care_plan_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  species TEXT NOT NULL,
  breed TEXT,
  life_stage_weeks_min INT NOT NULL,
  life_stage_weeks_max INT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  do_list TEXT[] DEFAULT '{}',
  dont_list TEXT[] DEFAULT '{}',
  red_flags TEXT[] DEFAULT '{}',
  trigger_offset_days INT,
  recurrence_days INT,
  premium_only BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_care_plan_templates_species ON public.care_plan_templates(species, life_stage_weeks_min);
ALTER TABLE public.care_plan_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Care plan templates viewable by everyone" ON public.care_plan_templates FOR SELECT USING (true);
CREATE POLICY "Super admins manage care plan templates" ON public.care_plan_templates FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.pet_care_plan_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  template_id UUID REFERENCES public.care_plan_templates(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  do_list TEXT[] DEFAULT '{}',
  dont_list TEXT[] DEFAULT '{}',
  red_flags TEXT[] DEFAULT '{}',
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  ai_personalised_note TEXT,
  premium_only BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pet_care_plan_items_pet_due ON public.pet_care_plan_items(pet_id, due_date);
CREATE INDEX idx_pet_care_plan_items_owner_due ON public.pet_care_plan_items(owner_id, due_date) WHERE status = 'pending';
ALTER TABLE public.pet_care_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view their pet care items" ON public.pet_care_plan_items FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert their pet care items" ON public.pet_care_plan_items FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update their pet care items" ON public.pet_care_plan_items FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete their pet care items" ON public.pet_care_plan_items FOR DELETE USING (auth.uid() = owner_id);

CREATE TRIGGER trg_breed_profiles_updated BEFORE UPDATE ON public.breed_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_care_plan_templates_updated BEFORE UPDATE ON public.care_plan_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pet_care_plan_items_updated BEFORE UPDATE ON public.pet_care_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();