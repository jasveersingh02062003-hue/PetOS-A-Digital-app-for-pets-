create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;

insert into public.app_settings(key, value) values
  ('supabase_url', 'https://pyqudgtmpnxnzzjbcdvc.supabase.co')
on conflict (key) do update set value = excluded.value, updated_at = now();

create or replace function public.tg_notifications_send_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_anon text;
  v_payload jsonb;
begin
  select value into v_url from public.app_settings where key = 'supabase_url';
  if v_url is null then
    return new;
  end if;

  v_anon := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cXVkZ3RtcG54bnp6amJjZHZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODM2MTQsImV4cCI6MjA5Mjk1OTYxNH0.heicqiE_NbcXiKq_7TNoYWhHTdtIB5sksHRq_ln5wNs';

  v_payload := jsonb_build_object(
    'user_id', new.user_id,
    'title',   coalesce(new.title, 'Petos'),
    'body',    coalesce(new.body, ''),
    'url',     coalesce(new.link, '/'),
    'tag',     new.type
  );

  begin
    perform net.http_post(
      url     := v_url || '/functions/v1/send-push',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'apikey',       v_anon,
                   'Authorization','Bearer ' || v_anon
                 ),
      body    := v_payload
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_notifications_send_push on public.notifications;
create trigger trg_notifications_send_push
after insert on public.notifications
for each row execute function public.tg_notifications_send_push();

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.reviews';
  exception when others then null;
  end;
end $$;

alter table public.reviews replica identity full;