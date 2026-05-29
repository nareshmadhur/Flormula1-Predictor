create table if not exists public.notification_platform_settings (
  id text primary key default 'global' check (id = 'global'),
  race_reminder_lead_hours integer not null default 24 check (race_reminder_lead_hours between 1 and 240),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references public.profiles on delete set null
);

alter table public.notification_platform_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_platform_settings'
      and policyname = 'Admins can read notification platform settings'
  ) then
    create policy "Admins can read notification platform settings"
    on public.notification_platform_settings
    for select using (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_platform_settings'
      and policyname = 'Platform admins can manage notification platform settings'
  ) then
    create policy "Platform admins can manage notification platform settings"
    on public.notification_platform_settings
    for all using (public.is_platform_admin())
    with check (public.is_platform_admin());
  end if;
end $$;

do $$
declare
  domain_setting_count integer;
  domain_setting_hours integer;
begin
  if to_regclass('public.notification_domain_settings') is not null then
    execute 'select count(*), max(race_reminder_lead_hours) from public.notification_domain_settings'
    into domain_setting_count, domain_setting_hours;

    if domain_setting_count = 1
      and domain_setting_hours is not null
      and not exists (select 1 from public.notification_platform_settings where id = 'global')
    then
      insert into public.notification_platform_settings (id, race_reminder_lead_hours)
      values ('global', domain_setting_hours)
      on conflict (id) do nothing;
    end if;
  end if;
end $$;
