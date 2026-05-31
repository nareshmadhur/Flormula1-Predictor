drop policy if exists "Admins can do everything on tenants" on public.tenants;

create policy "Platform admins can manage tenants"
on public.tenants for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create table public.group_requests (
  id uuid default gen_random_uuid() primary key,
  requested_by uuid references public.profiles on delete cascade not null,
  source_tenant_id uuid references public.tenants on delete set null,
  requested_name text not null check (char_length(btrim(requested_name)) between 3 and 80),
  description text check (description is null or char_length(description) <= 500),
  expected_player_count integer not null check (expected_player_count between 2 and 500),
  move_acknowledged_at timestamp with time zone not null,
  status text default 'pending' not null check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles on delete set null,
  reviewed_at timestamp with time zone,
  review_note text check (review_note is null or char_length(review_note) <= 500),
  approved_tenant_id uuid references public.tenants on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  check (
    (status = 'pending' and reviewed_at is null and approved_tenant_id is null)
    or (status = 'approved' and reviewed_at is not null and approved_tenant_id is not null)
    or (status = 'rejected' and reviewed_at is not null and approved_tenant_id is null)
  )
);

create unique index group_requests_one_pending_per_user_idx
on public.group_requests (requested_by)
where status = 'pending';

create index group_requests_status_created_at_idx
on public.group_requests (status, created_at);

alter table public.group_requests enable row level security;

create policy "Users can view own group requests"
on public.group_requests for select
to authenticated
using (requested_by = auth.uid() or public.is_platform_admin());

create policy "Users can create own pending group requests"
on public.group_requests for insert
to authenticated
with check (
  requested_by = auth.uid()
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and approved_tenant_id is null
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'user'
  )
  and source_tenant_id is not distinct from (
    select profile.tenant_id
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'user'
  )
);

create policy "Platform admins can update group requests"
on public.group_requests for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create or replace function public.approve_group_request(group_request_id uuid, group_slug text)
returns table (
  status text,
  approved_tenant_id uuid,
  approved_tenant_name text,
  requester_id uuid,
  message text
) as $$
declare
  request_record public.group_requests%rowtype;
  profile_record public.profiles%rowtype;
  tenant_record public.tenants%rowtype;
  clean_slug text;
begin
  if not public.is_platform_admin() then
    return query select
      'forbidden'::text,
      null::uuid,
      null::text,
      null::uuid,
      'Platform admin access is required.'::text;
    return;
  end if;

  clean_slug := lower(btrim(group_slug));

  if char_length(clean_slug) < 3
    or char_length(clean_slug) > 60
    or clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return query select
      'invalid_slug'::text,
      null::uuid,
      null::text,
      null::uuid,
      'Use a 3-60 character slug with lowercase letters, numbers, and single hyphens.'::text;
    return;
  end if;

  select *
  into request_record
  from public.group_requests
  where id = group_request_id
  for update;

  if not found then
    return query select
      'not_found'::text,
      null::uuid,
      null::text,
      null::uuid,
      'This group request was not found.'::text;
    return;
  end if;

  if request_record.status <> 'pending' then
    return query select
      'already_reviewed'::text,
      request_record.approved_tenant_id,
      null::text,
      request_record.requested_by,
      'This group request has already been reviewed.'::text;
    return;
  end if;

  select *
  into profile_record
  from public.profiles
  where id = request_record.requested_by
  for update;

  if not found then
    return query select
      'profile_missing'::text,
      null::uuid,
      null::text,
      request_record.requested_by,
      'The requester account was not found.'::text;
    return;
  end if;

  if profile_record.role <> 'user' then
    return query select
      'access_changed'::text,
      null::uuid,
      null::text,
      request_record.requested_by,
      'The requester now has admin access. Review and move this account manually.'::text;
    return;
  end if;

  if exists (
    select 1
    from public.tenants tenant
    where tenant.slug = clean_slug
  ) then
    return query select
      'slug_taken'::text,
      null::uuid,
      null::text,
      request_record.requested_by,
      'That slug is already in use. Choose another one.'::text;
    return;
  end if;

  insert into public.tenants (name, slug)
  values (btrim(request_record.requested_name), clean_slug)
  returning * into tenant_record;

  update public.profiles
  set
    role = 'admin',
    admin_scope = 'tenant',
    tenant_id = tenant_record.id
  where id = request_record.requested_by;

  update public.group_requests
  set
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = timezone('utc'::text, now()),
    approved_tenant_id = tenant_record.id,
    updated_at = timezone('utc'::text, now())
  where id = request_record.id;

  return query select
    'approved'::text,
    tenant_record.id,
    tenant_record.name,
    request_record.requested_by,
    ('Created ' || tenant_record.name || ' and promoted the requester to group admin.')::text;
end;
$$ language plpgsql security definer set search_path = public;

grant select, insert, update on public.group_requests to authenticated;
revoke all on function public.approve_group_request(uuid, text) from public;
grant execute on function public.approve_group_request(uuid, text) to authenticated;
