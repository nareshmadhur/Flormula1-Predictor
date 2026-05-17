create table if not exists public.notification_preferences (
  user_id uuid references public.profiles on delete cascade not null primary key,
  race_reminder_emails_enabled boolean default false not null,
  score_recap_emails_enabled boolean default false not null,
  unsubscribe_token text default replace((gen_random_uuid()::text || gen_random_uuid()::text), '-'::text, ''::text) not null unique,
  unsubscribed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists notification_preferences_email_enabled_idx
  on public.notification_preferences (race_reminder_emails_enabled, score_recap_emails_enabled);

create table if not exists public.notification_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  race_id uuid references public.races on delete cascade not null,
  event_key text not null,
  event_type text not null check (event_type in ('pre_lock_reminder', 'score_recap')),
  channel text default 'email' not null check (channel in ('email')),
  status text default 'queued' not null check (status in ('queued', 'sent', 'failed')),
  recipient_email text,
  subject text,
  scheduled_for timestamp with time zone,
  sent_at timestamp with time zone,
  error_message text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, race_id, event_key)
);

create index if not exists notification_events_race_event_idx
  on public.notification_events (race_id, event_key, status);

create index if not exists notification_events_user_created_idx
  on public.notification_events (user_id, created_at desc);

alter table public.notification_preferences enable row level security;
alter table public.notification_events enable row level security;

create policy "Users can read own notification preferences"
on public.notification_preferences
for select using (auth.uid() = user_id);

create policy "Users can insert own notification preferences"
on public.notification_preferences
for insert with check (auth.uid() = user_id);

create policy "Users can update own notification preferences"
on public.notification_preferences
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Platform admins can read notification preferences"
on public.notification_preferences
for select using (public.is_platform_admin());

create policy "Users can read own notification events"
on public.notification_events
for select using (auth.uid() = user_id);

create policy "Platform admins can read notification events"
on public.notification_events
for select using (public.is_platform_admin());

insert into public.notification_preferences (user_id)
select id
from public.profiles
on conflict (user_id) do nothing;

create or replace function public.wants_lifecycle_email(raw_metadata jsonb)
returns boolean as $$
  select lower(coalesce(raw_metadata->>'email_reminders_opt_in', 'false')) in ('true', '1', 'yes', 'on')
$$ language sql immutable;

create or replace function public.sync_confirmed_user_profile()
returns trigger as $$
declare
  next_display_name text;
  wants_email boolean;
begin
  next_display_name := nullif(btrim(new.raw_user_meta_data->>'display_name'), '');
  wants_email := public.wants_lifecycle_email(new.raw_user_meta_data);

  if new.email_confirmed_at is not null then
    insert into public.profiles (id, display_name, email, role, confirmed_at, tenant_id)
    values (new.id, next_display_name, new.email, 'user', new.email_confirmed_at, public.default_tenant_id())
    on conflict (id) do update
    set
      display_name = coalesce(excluded.display_name, public.profiles.display_name),
      email = excluded.email,
      confirmed_at = excluded.confirmed_at,
      tenant_id = coalesce(public.profiles.tenant_id, excluded.tenant_id);

    insert into public.notification_preferences (
      user_id,
      race_reminder_emails_enabled,
      score_recap_emails_enabled
    )
    values (new.id, wants_email, wants_email)
    on conflict (user_id) do nothing;
  elsif tg_op = 'INSERT' then
    delete from public.profiles where id = new.id;
  elsif old.email_confirmed_at is null then
    update public.profiles
    set
      confirmed_at = null,
      display_name = coalesce(next_display_name, public.profiles.display_name),
      email = new.email
    where id = new.id;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.handle_new_user()
returns trigger as $$
declare
  wants_email boolean;
begin
  wants_email := public.wants_lifecycle_email(new.raw_user_meta_data);

  insert into public.profiles (id, display_name, email, role, tenant_id)
  values (
    new.id,
    new.raw_user_meta_data->>'display_name',
    new.email,
    'user',
    public.default_tenant_id()
  );

  insert into public.notification_preferences (
    user_id,
    race_reminder_emails_enabled,
    score_recap_emails_enabled
  )
  values (new.id, wants_email, wants_email)
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
