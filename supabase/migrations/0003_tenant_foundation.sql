create table public.tenants (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.tenants enable row level security;

alter table public.profiles
  add column tenant_id uuid references public.tenants on delete set null;

create index profiles_tenant_id_idx on public.profiles (tenant_id);

create policy "Allow public read on tenants" on public.tenants for select using (true);
create policy "Admins can do everything on tenants" on public.tenants for all using (public.is_admin());
