CREATE OR REPLACE FUNCTION public.notify_skill_vouch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_pet_id uuid;
  v_pet_name text;
  v_skill_name text;
  v_voucher_name text;
BEGIN
  SELECT p.owner_id, p.id, p.name, ps.name
    INTO v_owner, v_pet_id, v_pet_name, v_skill_name
  FROM public.skill_spotlights s
  JOIN public.pets p ON p.id = s.pet_id
  JOIN public.pet_skills ps ON ps.id = s.skill_id
  WHERE s.id = NEW.spotlight_id;

  IF v_owner IS NULL OR v_owner = NEW.voucher_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, username, 'Someone')
    INTO v_voucher_name
  FROM public.profiles
  WHERE id = NEW.voucher_id;

  INSERT INTO public.notifications (user_id, actor_id, type, title, body, link)
  VALUES (
    v_owner,
    NEW.voucher_id,
    'skill_vouch',
    COALESCE(v_voucher_name, 'Someone') || ' vouched for ' || COALESCE(v_pet_name, 'your pet'),
    CASE WHEN v_skill_name IS NOT NULL THEN 'Skill: ' || v_skill_name ELSE NULL END,
    '/pet/' || v_pet_id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_skill_vouch ON public.skill_vouches;
CREATE TRIGGER trg_notify_skill_vouch
  AFTER INSERT ON public.skill_vouches
  FOR EACH ROW EXECUTE FUNCTION public.notify_skill_vouch();