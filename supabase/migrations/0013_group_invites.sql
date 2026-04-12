create table public.group_invites (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants on delete cascade not null,
  token_hash text not null unique,
  created_by uuid references public.profiles on delete set null,
  expires_at timestamp with time zone not null,
  max_uses integer default 100 not null check (max_uses > 0),
  accepted_count integer default 0 not null check (accepted_count >= 0),
  revoked_at timestamp with time zone,
  last_accepted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.group_invite_acceptances (
  id uuid default gen_random_uuid() primary key,
  invite_id uuid references public.group_invites on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  previous_tenant_id uuid references public.tenants on delete set null,
  accepted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (invite_id, user_id)
);

create index group_invites_tenant_id_idx on public.group_invites (tenant_id);
create index group_invites_token_hash_idx on public.group_invites (token_hash);
create index group_invite_acceptances_invite_id_idx on public.group_invite_acceptances (invite_id);
create index group_invite_acceptances_user_id_idx on public.group_invite_acceptances (user_id);

alter table public.group_invites enable row level security;
alter table public.group_invite_acceptances enable row level security;

create or replace function public.can_manage_group_invites(invite_tenant_id uuid)
returns boolean as $$
  select public.is_platform_admin()
    or (
      public.current_admin_tenant_id() is not null
      and public.current_admin_tenant_id() = invite_tenant_id
    );
$$ language sql security definer;

create policy "Group invite managers can view invites"
on public.group_invites for select
to authenticated
using (public.can_manage_group_invites(tenant_id));

create policy "Group invite managers can create invites"
on public.group_invites for insert
to authenticated
with check (
  public.can_manage_group_invites(tenant_id)
  and created_by = auth.uid()
);

create policy "Group invite managers can update invites"
on public.group_invites for update
to authenticated
using (public.can_manage_group_invites(tenant_id))
with check (public.can_manage_group_invites(tenant_id));

create policy "Group invite managers can view acceptances"
on public.group_invite_acceptances for select
to authenticated
using (
  exists (
    select 1
    from public.group_invites invite
    where invite.id = group_invite_acceptances.invite_id
      and public.can_manage_group_invites(invite.tenant_id)
  )
);

create or replace function public.get_group_invite_by_token(invite_token_hash text)
returns table (
  invite_id uuid,
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  expires_at timestamp with time zone,
  max_uses integer,
  accepted_count integer,
  revoked_at timestamp with time zone,
  status text
) as $$
begin
  return query
  select
    invite.id,
    invite.tenant_id,
    tenant.name,
    tenant.slug,
    invite.expires_at,
    invite.max_uses,
    invite.accepted_count,
    invite.revoked_at,
    case
      when invite.revoked_at is not null then 'revoked'
      when invite.expires_at <= timezone('utc'::text, now()) then 'expired'
      when invite.accepted_count >= invite.max_uses then 'full'
      else 'active'
    end as status
  from public.group_invites invite
  join public.tenants tenant on tenant.id = invite.tenant_id
  where invite.token_hash = $1
  limit 1;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.accept_group_invite(invite_token_hash text)
returns table (
  status text,
  tenant_id uuid,
  tenant_name text,
  message text
) as $$
declare
  invite_record public.group_invites%rowtype;
  profile_record public.profiles%rowtype;
  tenant_record public.tenants%rowtype;
  already_accepted boolean := false;
  inserted_acceptance_count integer := 0;
begin
  if auth.uid() is null then
    return query select
      'auth_required'::text,
      null::uuid,
      null::text,
      'Sign in before joining this group.'::text;
    return;
  end if;

  select *
  into invite_record
  from public.group_invites
  where token_hash = $1
  for update;

  if not found then
    return query select
      'invalid'::text,
      null::uuid,
      null::text,
      'This invite link was not found.'::text;
    return;
  end if;

  select *
  into tenant_record
  from public.tenants
  where id = invite_record.tenant_id;

  if not found then
    return query select
      'invalid'::text,
      null::uuid,
      null::text,
      'This group is no longer available.'::text;
    return;
  end if;

  if invite_record.revoked_at is not null then
    return query select
      'revoked'::text,
      tenant_record.id,
      tenant_record.name,
      'This invite link has been revoked.'::text;
    return;
  end if;

  if invite_record.expires_at <= timezone('utc'::text, now()) then
    return query select
      'expired'::text,
      tenant_record.id,
      tenant_record.name,
      'This invite link has expired.'::text;
    return;
  end if;

  select *
  into profile_record
  from public.profiles
  where id = auth.uid()
  for update;

  if not found then
    return query select
      'profile_missing'::text,
      tenant_record.id,
      tenant_record.name,
      'Confirm your email before joining this group.'::text;
    return;
  end if;

  if profile_record.tenant_id = invite_record.tenant_id then
    return query select
      'already_member'::text,
      tenant_record.id,
      tenant_record.name,
      'You are already in this group.'::text;
    return;
  end if;

  if profile_record.role = 'admin'
    and profile_record.admin_scope = 'tenant'
    and profile_record.tenant_id is not null
    and profile_record.tenant_id <> invite_record.tenant_id then
    return query select
      'group_admin_conflict'::text,
      tenant_record.id,
      tenant_record.name,
      'Group managers cannot switch groups through an invite link. Ask a platform admin to move the account.'::text;
    return;
  end if;

  select exists (
    select 1
    from public.group_invite_acceptances acceptance
    where acceptance.invite_id = invite_record.id
      and acceptance.user_id = auth.uid()
  )
  into already_accepted;

  if not already_accepted and invite_record.accepted_count >= invite_record.max_uses then
    return query select
      'full'::text,
      tenant_record.id,
      tenant_record.name,
      'This invite link has reached its limit.'::text;
    return;
  end if;

  update public.profiles
  set tenant_id = invite_record.tenant_id
  where id = auth.uid();

  if not already_accepted then
    insert into public.group_invite_acceptances (invite_id, user_id, previous_tenant_id)
    values (invite_record.id, auth.uid(), profile_record.tenant_id)
    on conflict (invite_id, user_id) do nothing;

    get diagnostics inserted_acceptance_count = row_count;

    if inserted_acceptance_count > 0 then
      update public.group_invites
      set
        accepted_count = accepted_count + 1,
        last_accepted_at = timezone('utc'::text, now())
      where id = invite_record.id;
    end if;
  end if;

  return query select
    'joined'::text,
    tenant_record.id,
    tenant_record.name,
    ('You joined ' || tenant_record.name || '.')::text;
end;
$$ language plpgsql security definer set search_path = public;

grant select, insert, update on public.group_invites to authenticated;
grant select on public.group_invite_acceptances to authenticated;
grant execute on function public.get_group_invite_by_token(text) to anon, authenticated;
grant execute on function public.accept_group_invite(text) to authenticated;
