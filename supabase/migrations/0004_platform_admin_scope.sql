create or replace function public.current_admin_tenant_id()
returns uuid as $$
  select tenant_id
  from public.profiles
  where id = auth.uid() and role = 'admin'
$$ language sql security definer;

create or replace function public.is_platform_admin()
returns boolean as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and tenant_id is null
  );
$$ language sql security definer;

drop policy if exists "Admins can view all predictions" on public.predictions;
create policy "Admins can view scoped predictions" on public.predictions for select using (
  public.is_platform_admin()
  or (
    public.current_admin_tenant_id() is not null
    and user_id in (
      select id from public.profiles
      where tenant_id = public.current_admin_tenant_id()
    )
  )
);

drop policy if exists "Admins can view all prediction answers" on public.prediction_bonus_answers;
create policy "Admins can view scoped prediction answers" on public.prediction_bonus_answers for select using (
  public.is_platform_admin()
  or (
    public.current_admin_tenant_id() is not null
    and prediction_id in (
      select p.id
      from public.predictions p
      join public.profiles pr on pr.id = p.user_id
      where pr.tenant_id = public.current_admin_tenant_id()
    )
  )
);

drop policy if exists "Admins can do everything on user_race_scores" on public.user_race_scores;
create policy "Platform admins can manage all user race scores" on public.user_race_scores for all using (
  public.is_platform_admin()
);

create policy "Tenant admins can view scoped user race scores" on public.user_race_scores for select using (
  public.current_admin_tenant_id() is not null
  and user_id in (
    select id from public.profiles
    where tenant_id = public.current_admin_tenant_id()
  )
);
