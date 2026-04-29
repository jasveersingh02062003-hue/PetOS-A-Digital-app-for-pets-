-- 1) Mating agreement signed PDF + auto lock
ALTER TABLE public.mating_agreements
  ADD COLUMN IF NOT EXISTS signed_pdf_url text,
  ADD COLUMN IF NOT EXISTS agreement_number text;

CREATE OR REPLACE FUNCTION public.tg_lock_agreement_when_fully_signed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if new.from_signature is not null and new.to_signature is not null
     and (old.terms_locked is null or old.terms_locked = false)
  then
    new.terms_locked := true;
    if new.agreement_number is null then
      new.agreement_number := 'PMA-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(new.id::text,'-',''),1,6);
    end if;
  end if;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS lock_agreement_when_fully_signed ON public.mating_agreements;
CREATE TRIGGER lock_agreement_when_fully_signed
  BEFORE UPDATE ON public.mating_agreements
  FOR EACH ROW EXECUTE FUNCTION public.tg_lock_agreement_when_fully_signed();

-- Same logic on insert in case both signatures land in one shot (rare)
CREATE OR REPLACE FUNCTION public.tg_lock_agreement_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if new.from_signature is not null and new.to_signature is not null then
    new.terms_locked := true;
    if new.agreement_number is null then
      new.agreement_number := 'PMA-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(new.id::text,'-',''),1,6);
    end if;
  end if;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS lock_agreement_on_insert ON public.mating_agreements;
CREATE TRIGGER lock_agreement_on_insert
  BEFORE INSERT ON public.mating_agreements
  FOR EACH ROW EXECUTE FUNCTION public.tg_lock_agreement_on_insert();

-- 2) GST columns on payment intents
ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS gst_rate_pct numeric(5,2) NOT NULL DEFAULT 18.00,
  ADD COLUMN IF NOT EXISTS gst_amount_inr integer,
  ADD COLUMN IF NOT EXISTS subtotal_inr integer,
  ADD COLUMN IF NOT EXISTS place_of_supply text;

-- Backfill GST for existing paid intents (gross-inclusive: amount = subtotal + gst)
UPDATE public.payment_intents
   SET gst_amount_inr = round(amount_inr - amount_inr / 1.18),
       subtotal_inr   = round(amount_inr / 1.18)
 WHERE amount_inr is not null and gst_amount_inr is null;

-- 3) Boarding vaccination eligibility
CREATE OR REPLACE FUNCTION public.check_pet_boarding_eligible(_pet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_species text;
  v_missing text[] := '{}';
  v_today date := current_date;
  v_has_dhpp boolean;
  v_has_rabies boolean;
  v_has_fvrcp boolean;
begin
  select lower(species) into v_species from public.pets where id = _pet_id;
  if v_species is null then
    return jsonb_build_object('eligible', false, 'reason', 'pet not found');
  end if;

  if v_species = 'dog' then
    select exists(select 1 from public.vaccinations
      where pet_id = _pet_id
        and (vaccine_name ilike '%dhpp%' or vaccine_name ilike '%distemper%' or vaccine_name ilike '%dap%')
        and (next_due_on is null or next_due_on >= v_today)
        and administered_on >= v_today - interval '1 year') into v_has_dhpp;
    select exists(select 1 from public.vaccinations
      where pet_id = _pet_id
        and vaccine_name ilike '%rabies%'
        and (next_due_on is null or next_due_on >= v_today)
        and administered_on >= v_today - interval '3 years') into v_has_rabies;
    if not v_has_dhpp then v_missing := array_append(v_missing, 'DHPP / Distemper'); end if;
    if not v_has_rabies then v_missing := array_append(v_missing, 'Rabies'); end if;
  elsif v_species = 'cat' then
    select exists(select 1 from public.vaccinations
      where pet_id = _pet_id
        and (vaccine_name ilike '%fvrcp%' or vaccine_name ilike '%feline%')
        and (next_due_on is null or next_due_on >= v_today)
        and administered_on >= v_today - interval '1 year') into v_has_fvrcp;
    select exists(select 1 from public.vaccinations
      where pet_id = _pet_id
        and vaccine_name ilike '%rabies%'
        and (next_due_on is null or next_due_on >= v_today)) into v_has_rabies;
    if not v_has_fvrcp then v_missing := array_append(v_missing, 'FVRCP'); end if;
    if not v_has_rabies then v_missing := array_append(v_missing, 'Rabies'); end if;
  else
    return jsonb_build_object('eligible', true, 'reason', 'no boarding requirements for this species');
  end if;

  return jsonb_build_object(
    'eligible', coalesce(array_length(v_missing,1),0) = 0,
    'missing', v_missing,
    'species', v_species
  );
end;
$$;

REVOKE ALL ON FUNCTION public.check_pet_boarding_eligible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_pet_boarding_eligible(uuid) TO authenticated;