alter table public.profiles
  add column if not exists admin_scope text check (admin_scope in ('platform', 'tenant'));

update public.profiles
set admin_scope = case
  when role = 'admin' and tenant_id is null then 'platform'
  when role = 'admin' and tenant_id is not null then 'tenant'
  else null
end
where admin_scope is null;

alter table public.profiles
  drop constraint if exists profiles_admin_scope_matches_role;

alter table public.profiles
  add constraint profiles_admin_scope_matches_role check (
    (role = 'user' and admin_scope is null)
    or (role = 'admin' and admin_scope = 'platform' and tenant_id is null)
    or (role = 'admin' and admin_scope = 'tenant' and tenant_id is not null)
  );

create or replace function public.current_admin_tenant_id()
returns uuid as $$
  select tenant_id
  from public.profiles
  where id = auth.uid() and role = 'admin' and admin_scope = 'tenant'
$$ language sql security definer;

create or replace function public.is_platform_admin()
returns boolean as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and admin_scope = 'platform'
  );
$$ language sql security definer;
