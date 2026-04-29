
CREATE OR REPLACE FUNCTION public.on_vet_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_asker uuid; v_title text;
BEGIN
  UPDATE public.vet_questions
    SET answer_count = answer_count + 1,
        status = CASE WHEN status = 'open' THEN 'answered'::vet_q_status ELSE status END
    WHERE id = NEW.question_id
    RETURNING asker_id, title INTO v_asker, v_title;
  IF v_asker IS NOT NULL AND v_asker <> NEW.vet_id THEN
    PERFORM public.notify_user_with_actor(v_asker, NEW.vet_id, 'vet_answer',
      'A vet answered your question',
      LEFT(NEW.body, 80),
      '/askvet/' || NEW.question_id);
  END IF;
  RETURN NEW;
END $$;
