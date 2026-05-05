insert into public.tenants (name, slug, is_test)
values ('Main Group', 'main', false)
on conflict (slug) do update
set name = excluded.name;

update public.profiles
set tenant_id = (select id from public.tenants where slug = 'main')
where role = 'user'
  and tenant_id is null
  and exists (select 1 from public.tenants where slug = 'main');

create or replace function public.default_tenant_id()
returns uuid as $$
  select id
  from public.tenants
  where slug = 'main'
  limit 1;
$$ language sql security definer set search_path = public;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, email, role, tenant_id)
  values (
    new.id,
    new.raw_user_meta_data->>'display_name',
    new.email,
    'user',
    public.default_tenant_id()
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;
