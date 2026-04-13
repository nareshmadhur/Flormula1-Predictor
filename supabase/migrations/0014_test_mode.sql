alter table public.tenants
  add column if not exists is_test boolean default false not null;

alter table public.profiles
  add column if not exists is_test boolean default false not null;

create index if not exists tenants_is_test_idx on public.tenants (is_test);
create index if not exists profiles_is_test_idx on public.profiles (is_test);
