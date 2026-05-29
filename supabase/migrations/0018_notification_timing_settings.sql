create table if not exists public.notification_domain_settings (
  domain text primary key,
  race_reminder_lead_hours integer not null default 24 check (race_reminder_lead_hours between 1 and 240),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references public.profiles on delete set null,
  constraint notification_domain_settings_domain_format check (
    domain = lower(domain)
    and domain !~ '\s'
    and position('@' in domain) = 0
    and position('.' in domain) > 1
  )
);

create table if not exists public.notification_tenant_settings (
  tenant_id uuid references public.tenants on delete cascade primary key,
  race_reminder_lead_hours integer check (race_reminder_lead_hours between 1 and 240),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references public.profiles on delete set null
);

alter table public.notification_domain_settings enable row level security;
alter table public.notification_tenant_settings enable row level security;

create policy "Admins can read notification domain settings"
on public.notification_domain_settings
for select using (public.is_admin());

create policy "Platform admins can manage notification domain settings"
on public.notification_domain_settings
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
