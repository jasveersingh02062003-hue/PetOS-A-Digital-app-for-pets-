create or replace function public.tg_walk_event_to_suggestion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_pet uuid;
  v_reason text;
begin
  if new.kind <> 'health_flag' then
    return new;
  end if;

  select b.customer_id, b.pet_id
    into v_owner, v_pet
  from public.service_bookings b
  where b.id = new.booking_id;

  if v_owner is null then
    return new;
  end if;

  v_reason := coalesce(
    nullif(trim(new.payload->>'note'), ''),
    'Walker flagged a health concern during the walk.'
  );

  insert into public.booking_suggestions
    (owner_id, pet_id, kind, reason, source_walk_event_id, source_booking_id, deep_link)
  values
    (v_owner, v_pet, 'vet_followup', v_reason, new.id, new.booking_id,
     '/services/vet?source=walk_flag&pet=' || coalesce(v_pet::text, ''));

  insert into public.notifications (user_id, actor_id, type, title, body, link)
  values (
    v_owner,
    new.author_id,
    'walk_health_flag',
    'Health flag during walk',
    v_reason,
    '/services/vet?source=walk_flag&pet=' || coalesce(v_pet::text, '')
  );

  return new;
end;
$$;