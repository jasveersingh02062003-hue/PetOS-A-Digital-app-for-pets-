-- Phase E: Public trust signals
create table if not exists public.anon_reports (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('listing','provider','user','product','mate_listing','org')),
  subject_id uuid not null,
  reason text not null,
  details text,
  reporter_session text,
  user_agent text,
  status text not null default 'open' check (status in ('open','reviewed','dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_anon_reports_subject on public.anon_reports (subject_type, subject_id);
create index if not exists idx_anon_reports_session_time on public.anon_reports (reporter_session, created_at desc);

alter table public.anon_reports enable row level security;

create or replace function public.enforce_anon_report_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  recent int;
begin
  if new.reporter_session is null or length(new.reporter_session) < 10 then
    raise exception 'reporter_session is required';
  end if;
  select count(*) into recent
    from public.anon_reports
   where reporter_session = new.reporter_session
     and created_at > now() - interval '1 hour';
  if recent >= 5 then
    raise exception 'rate_limited: too many reports from this session, try again later';
  end if;
  new.details := left(coalesce(new.details, ''), 1000);
  new.user_agent := left(coalesce(new.user_agent, ''), 300);
  new.reason := left(new.reason, 80);
  return new;
end $$;

drop trigger if exists trg_anon_reports_rate on public.anon_reports;
create trigger trg_anon_reports_rate
  before insert on public.anon_reports
  for each row execute function public.enforce_anon_report_rate_limit();

drop policy if exists "anon_reports_insert_anyone" on public.anon_reports;
create policy "anon_reports_insert_anyone"
  on public.anon_reports for insert
  to anon, authenticated
  with check (true);

drop policy if exists "anon_reports_select_admin" on public.anon_reports;
create policy "anon_reports_select_admin"
  on public.anon_reports for select
  to authenticated
  using (has_role(auth.uid(), 'super_admin') or has_role(auth.uid(), 'moderator'));

drop policy if exists "anon_reports_update_admin" on public.anon_reports;
create policy "anon_reports_update_admin"
  on public.anon_reports for update
  to authenticated
  using (has_role(auth.uid(), 'super_admin') or has_role(auth.uid(), 'moderator'))
  with check (has_role(auth.uid(), 'super_admin') or has_role(auth.uid(), 'moderator'));

create or replace function public.seller_trust(_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_verified boolean := false;
  v_account_type text;
  v_member_since timestamptz;
  v_response_min int;
  v_completed_bookings int := 0;
  v_completed_orders int := 0;
  v_org jsonb;
begin
  select breeder_verified, account_type::text, created_at
    into v_verified, v_account_type, v_member_since
    from public.profiles where id = _user_id;

  select jsonb_build_object('org_type', org_type, 'status', status, 'org_name', org_name)
    into v_org from public.org_profiles where user_id = _user_id;
  if v_org is not null and v_org->>'status' = 'approved' then
    v_verified := true;
  end if;

  with seller_msgs as (
    select m.conversation_id, m.created_at as t,
           lag(m.sender_id) over (partition by m.conversation_id order by m.created_at) as prev_sender,
           lag(m.created_at) over (partition by m.conversation_id order by m.created_at) as prev_t,
           m.sender_id
      from public.messages m
     where m.created_at > now() - interval '90 days'
       and m.conversation_id in (
         select conversation_id from public.conversation_members where user_id = _user_id
       )
  )
  select percentile_cont(0.5) within group (
           order by extract(epoch from (t - prev_t))/60.0
         )::int
    into v_response_min
    from seller_msgs
   where sender_id = _user_id
     and prev_sender is not null
     and prev_sender <> _user_id
     and (t - prev_t) < interval '7 days';

  select count(*)::int into v_completed_bookings
    from public.service_bookings sb
    join public.service_providers sp on sp.id = sb.provider_id
   where sp.owner_id = _user_id and sb.status = 'completed';

  select count(*)::int into v_completed_orders
    from public.shop_order_items soi
    join public.shop_orders so on so.id = soi.order_id
   where soi.seller_id = _user_id and so.status in ('delivered','completed');

  return jsonb_build_object(
    'verified', v_verified,
    'account_type', v_account_type,
    'member_since', v_member_since,
    'response_minutes', v_response_min,
    'completed_bookings', v_completed_bookings,
    'completed_orders', v_completed_orders,
    'org', v_org
  );
exception when others then
  return jsonb_build_object('verified', false);
end $$;

revoke all on function public.seller_trust(uuid) from public;
grant execute on function public.seller_trust(uuid) to anon, authenticated;