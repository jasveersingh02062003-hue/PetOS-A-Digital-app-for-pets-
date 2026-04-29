-- 1) Default commission rate for puppy sales
INSERT INTO public.commission_rates(kind, rate_pct, notes)
VALUES ('puppy_sale', 8.00, 'Puppy/breeder sale commission')
ON CONFLICT (kind) DO NOTHING;

-- 2) Extend payout trigger to handle puppy_sale
CREATE OR REPLACE FUNCTION public.tg_create_provider_payout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_provider uuid;
  v_kind     text := new.kind::text;
  v_rate     numeric(5,2);
  v_commission integer;
  v_net      integer;
begin
  if new.status <> 'paid' then return new; end if;
  if (tg_op = 'UPDATE' and old.status = 'paid') then return new; end if;
  if new.ref_id is null then return new; end if;

  if v_kind = 'transport' then
    select provider_id into v_provider from public.transport_bookings where id = new.ref_id;
  elsif v_kind = 'service' then
    select provider_id into v_provider from public.service_bookings where id = new.ref_id;
  elsif v_kind = 'appointment' then
    select vet_id into v_provider from public.appointments where id = new.ref_id;
  elsif v_kind = 'vet_consult' then
    select vet_id into v_provider from public.vet_consults where id = new.ref_id;
  elsif v_kind = 'puppy_sale' then
    select owner_id into v_provider from public.pet_listings where id = new.ref_id;
  else
    return new;
  end if;

  if v_provider is null then return new; end if;

  select rate_pct into v_rate from public.commission_rates where kind = v_kind;
  if v_rate is null then v_rate := 15; end if;

  v_commission := round(new.amount_inr * v_rate / 100.0);
  v_net        := new.amount_inr - v_commission;

  insert into public.provider_payouts(provider_user_id, payment_intent_id, kind, ref_id, gross_inr, commission_inr, net_inr)
  values (v_provider, new.id, v_kind, new.ref_id, new.amount_inr, v_commission, v_net)
  on conflict (payment_intent_id) do nothing;

  return new;
exception when others then
  raise warning 'tg_create_provider_payout failed: %', sqlerrm;
  return new;
end;
$function$;

-- 3) Triage → vet_consult bridge
-- Called from the booking flow to spawn a consult row that surfaces the AI
-- summary, severity and symptoms to the vet.
CREATE OR REPLACE FUNCTION public.create_consult_from_appointment(_appointment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_appt   record;
  v_triage record;
  v_consult_id uuid;
begin
  select * into v_appt from public.appointments where id = _appointment_id;
  if v_appt is null then
    raise exception 'appointment not found';
  end if;
  -- Only the owner of the appointment may invoke this
  if v_appt.owner_id <> auth.uid() then
    raise exception 'not allowed';
  end if;
  if v_appt.triage_session_id is null then
    return null;
  end if;
  -- Idempotent: one consult per appointment
  select id into v_consult_id from public.vet_consults
    where pet_id = v_appt.pet_id and owner_id = v_appt.owner_id
      and vet_id = v_appt.vet_id and status in ('awaiting_vet','assigned','in_progress')
    order by created_at desc limit 1;
  if v_consult_id is not null then
    return v_consult_id;
  end if;

  select * into v_triage from public.vet_triage_sessions where id = v_appt.triage_session_id;
  insert into public.vet_consults(pet_id, owner_id, vet_id, severity, status, ai_summary, symptoms)
  values (
    v_appt.pet_id,
    v_appt.owner_id,
    v_appt.vet_id,
    coalesce(v_triage.severity, 'moderate'::severity_level),
    'assigned'::consult_status,
    v_triage.ai_summary,
    case when v_triage.transcript is not null
         then array(select jsonb_array_elements_text(v_triage.transcript -> 'symptoms'))
         else null end
  )
  returning id into v_consult_id;

  return v_consult_id;
end;
$$;

REVOKE ALL ON FUNCTION public.create_consult_from_appointment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_consult_from_appointment(uuid) TO authenticated;