create table if not exists public.notification_platform_settings (
  id text primary key default 'global' check (id = 'global'),
  race_reminder_lead_hours integer not null default 24 check (race_reminder_lead_hours between 1 and 240),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references public.profiles on delete set null
);

create table if not exists public.notification_tenant_settings (
  tenant_id uuid references public.tenants on delete cascade primary key,
  race_reminder_lead_hours integer check (race_reminder_lead_hours between 1 and 240),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references public.profiles on delete set null
);

alter table public.notification_platform_settings enable row level security;
alter table public.notification_tenant_settings enable row level security;

create policy "Admins can read notification platform settings"
on public.notification_platform_settings
for select using (public.is_admin());

create policy "Platform admins can manage notification platform settings"
on public.notification_platform_settings
for all using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Admins can read notification tenant settings"
on public.notification_tenant_settings
for select using (
  public.is_platform_admin()
  or tenant_id = public.current_admin_tenant_id()
);

create policy "Platform admins can manage notification tenant settings"
on public.notification_tenant_settings
for all using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Tenant admins can manage own notification tenant settings"
on public.notification_tenant_settings
for all using (tenant_id = public.current_admin_tenant_id())
with check (tenant_id = public.current_admin_tenant_id());
