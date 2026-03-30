alter table public.profiles
  add column if not exists confirmed_at timestamp with time zone;

update public.profiles as profile
set confirmed_at = auth_user.email_confirmed_at
from auth.users as auth_user
where auth_user.id = profile.id;

insert into public.profiles (id, display_name, email, role, confirmed_at)
select
  auth_user.id,
  nullif(btrim(auth_user.raw_user_meta_data->>'display_name'), ''),
  auth_user.email,
  'user',
  auth_user.email_confirmed_at
from auth.users as auth_user
where auth_user.email_confirmed_at is not null
on conflict (id) do update
set
  display_name = coalesce(excluded.display_name, public.profiles.display_name),
  email = excluded.email,
  confirmed_at = excluded.confirmed_at;

create or replace function public.sync_confirmed_user_profile()
returns trigger as $$
declare
  next_display_name text;
begin
  next_display_name := nullif(btrim(new.raw_user_meta_data->>'display_name'), '');

  if new.email_confirmed_at is not null then
    insert into public.profiles (id, display_name, email, role, confirmed_at)
    values (new.id, next_display_name, new.email, 'user', new.email_confirmed_at)
    on conflict (id) do update
    set
      display_name = coalesce(excluded.display_name, public.profiles.display_name),
      email = excluded.email,
      confirmed_at = excluded.confirmed_at;
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
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_synced on auth.users;

create trigger on_auth_user_synced
  after insert or update of email_confirmed_at, email, raw_user_meta_data on auth.users
  for each row execute procedure public.sync_confirmed_user_profile();

drop policy if exists "Allow public read on profiles" on public.profiles;

create policy "Allow confirmed profile reads" on public.profiles
for select using (confirmed_at is not null);
