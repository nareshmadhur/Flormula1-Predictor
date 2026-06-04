alter table public.bonus_questions
  add column if not exists tenant_id uuid references public.tenants on delete cascade;

create index if not exists bonus_questions_race_tenant_idx
on public.bonus_questions (race_id, tenant_id);

create index if not exists bonus_questions_tenant_idx
on public.bonus_questions (tenant_id)
where tenant_id is not null;

create or replace function public.current_user_tenant_id()
returns uuid as $$
  select tenant_id
  from public.profiles
  where id = auth.uid()
$$ language sql stable security definer set search_path = public;

create or replace function public.can_read_bonus_question(question_tenant_id uuid)
returns boolean as $$
  select question_tenant_id is null
    or public.is_platform_admin()
    or question_tenant_id = public.current_user_tenant_id();
$$ language sql stable security definer set search_path = public;

create or replace function public.can_manage_bonus_question(question_tenant_id uuid)
returns boolean as $$
  select public.is_platform_admin()
    or (
      question_tenant_id is not null
      and question_tenant_id = public.current_admin_tenant_id()
    );
$$ language sql stable security definer set search_path = public;

drop policy if exists "Allow public read on bonus_questions" on public.bonus_questions;
drop policy if exists "Admins can do everything on bonus_questions" on public.bonus_questions;
drop policy if exists "Platform admins can manage bonus questions" on public.bonus_questions;

create policy "Scoped read on bonus questions"
on public.bonus_questions for select
using (public.can_read_bonus_question(tenant_id));

create policy "Scoped admins can manage bonus questions"
on public.bonus_questions for all
using (public.can_manage_bonus_question(tenant_id))
with check (public.can_manage_bonus_question(tenant_id));

drop policy if exists "Allow public read on bonus_options" on public.bonus_options;
drop policy if exists "Admins can do everything on bonus_options" on public.bonus_options;
drop policy if exists "Platform admins can manage bonus options" on public.bonus_options;

create policy "Scoped read on bonus options"
on public.bonus_options for select
using (
  exists (
    select 1
    from public.bonus_questions question
    where question.id = bonus_options.bonus_question_id
      and public.can_read_bonus_question(question.tenant_id)
  )
);

create policy "Scoped admins can manage bonus options"
on public.bonus_options for all
using (
  exists (
    select 1
    from public.bonus_questions question
    where question.id = bonus_options.bonus_question_id
      and public.can_manage_bonus_question(question.tenant_id)
  )
)
with check (
  exists (
    select 1
    from public.bonus_questions question
    where question.id = bonus_options.bonus_question_id
      and public.can_manage_bonus_question(question.tenant_id)
  )
);

drop policy if exists "Allow public read on race_bonus_answers" on public.race_bonus_answers;
drop policy if exists "Admins can do everything on race_bonus_answers" on public.race_bonus_answers;
drop policy if exists "Platform admins can manage race bonus answers" on public.race_bonus_answers;

create policy "Scoped read on race bonus answers"
on public.race_bonus_answers for select
using (
  exists (
    select 1
    from public.bonus_questions question
    where question.id = race_bonus_answers.bonus_question_id
      and public.can_read_bonus_question(question.tenant_id)
  )
);

create policy "Scoped admins can manage race bonus answers"
on public.race_bonus_answers for all
using (
  exists (
    select 1
    from public.bonus_questions question
    where question.id = race_bonus_answers.bonus_question_id
      and public.can_manage_bonus_question(question.tenant_id)
  )
)
with check (
  exists (
    select 1
    from public.bonus_questions question
    where question.id = race_bonus_answers.bonus_question_id
      and public.can_manage_bonus_question(question.tenant_id)
  )
);

drop policy if exists "Allow public read on scored prediction bonus answers" on public.prediction_bonus_answers;
create policy "Scoped read on scored prediction bonus answers"
on public.prediction_bonus_answers
for select
using (
  exists (
    select 1
    from public.predictions prediction
    join public.races race on race.id = prediction.race_id
    where prediction.id = prediction_bonus_answers.prediction_id
      and race.status = 'scored'
  )
  and exists (
    select 1
    from public.bonus_questions question
    where question.id = prediction_bonus_answers.bonus_question_id
      and public.can_read_bonus_question(question.tenant_id)
  )
);

create table if not exists public.tenant_bonus_answer_audit (
  id uuid default gen_random_uuid() primary key,
  race_id uuid references public.races on delete cascade not null,
  tenant_id uuid references public.tenants on delete cascade not null,
  bonus_answers jsonb default '{}'::jsonb not null,
  changed_by uuid references public.profiles on delete set null,
  changed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.tenant_bonus_answer_audit enable row level security;

drop policy if exists "Scoped admins can read tenant bonus answer audit" on public.tenant_bonus_answer_audit;
create policy "Scoped admins can read tenant bonus answer audit"
on public.tenant_bonus_answer_audit for select
using (
  public.is_platform_admin()
  or tenant_id = public.current_admin_tenant_id()
);

create or replace function public.enforce_bonus_question_write_window()
returns trigger as $$
declare
  race_record public.races%rowtype;
  target_race_id uuid;
  target_tenant_id uuid;
begin
  if public.is_platform_admin() or coalesce(auth.role() = 'service_role', false) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  target_race_id := case when tg_op = 'DELETE' then old.race_id else new.race_id end;
  target_tenant_id := case when tg_op = 'DELETE' then old.tenant_id else new.tenant_id end;

  if target_tenant_id is null then
    raise exception 'Group bonus questions must belong to a group';
  end if;

  if tg_op = 'UPDATE' and (
    new.race_id <> old.race_id
    or new.tenant_id is distinct from old.tenant_id
  ) then
    raise exception 'Group bonus questions cannot be moved between races or groups';
  end if;

  select *
  into race_record
  from public.races
  where id = target_race_id;

  if not found then
    raise exception 'Race not found';
  end if;

  if race_record.status <> 'upcoming'
    or timezone('utc'::text, now()) >= race_record.prediction_lock_at
  then
    raise exception 'Group bonus questions can only be changed before prediction lock';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists enforce_bonus_question_write_window on public.bonus_questions;
create trigger enforce_bonus_question_write_window
before insert or update or delete on public.bonus_questions
for each row execute procedure public.enforce_bonus_question_write_window();

create or replace function public.enforce_bonus_option_write_window()
returns trigger as $$
declare
  race_record public.races%rowtype;
  target_question_id uuid;
  question_record public.bonus_questions%rowtype;
begin
  if public.is_platform_admin() or coalesce(auth.role() = 'service_role', false) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  target_question_id := case when tg_op = 'DELETE' then old.bonus_question_id else new.bonus_question_id end;

  if tg_op = 'UPDATE' and new.bonus_question_id <> old.bonus_question_id then
    raise exception 'Bonus options cannot be moved between questions';
  end if;

  select *
  into question_record
  from public.bonus_questions
  where id = target_question_id;

  if not found then
    raise exception 'Bonus question not found';
  end if;

  if question_record.tenant_id is null then
    raise exception 'Only platform admins can change global bonus options';
  end if;

  select *
  into race_record
  from public.races
  where id = question_record.race_id;

  if not found then
    raise exception 'Race not found';
  end if;

  if race_record.status <> 'upcoming'
    or timezone('utc'::text, now()) >= race_record.prediction_lock_at
  then
    raise exception 'Group bonus options can only be changed before prediction lock';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists enforce_bonus_option_write_window on public.bonus_options;
create trigger enforce_bonus_option_write_window
before insert or update or delete on public.bonus_options
for each row execute procedure public.enforce_bonus_option_write_window();

create or replace function public.validate_prediction_bonus_answer()
returns trigger as $$
begin
  if not exists (
    select 1
    from public.predictions prediction
    join public.profiles owner
      on owner.id = prediction.user_id
    join public.bonus_questions question
      on question.id = new.bonus_question_id
     and question.race_id = prediction.race_id
     and question.is_active
     and (
       question.tenant_id is null
       or question.tenant_id = owner.tenant_id
     )
    join public.bonus_options option
      on option.id = new.bonus_option_id
     and option.bonus_question_id = question.id
    where prediction.id = new.prediction_id
  ) then
    raise exception 'Prediction bonus answer does not match the prediction race, group, and question';
  end if;

  return new;
end;
$$ language plpgsql set search_path = public;

create or replace function public.recalculate_race_scores_internal(p_race_id uuid)
returns table(season integer, predictions_count integer) as $$
declare
  race_record public.races%rowtype;
  result_record public.race_results%rowtype;
begin
  select *
  into race_record
  from public.races
  where id = p_race_id;

  if not found then
    raise exception 'Race not found';
  end if;

  select *
  into result_record
  from public.race_results
  where race_id = p_race_id;

  if not found then
    raise exception 'Save official results first';
  end if;

  if result_record.p1_driver_id = result_record.p2_driver_id
    or result_record.p1_driver_id = result_record.p3_driver_id
    or result_record.p2_driver_id = result_record.p3_driver_id
  then
    raise exception 'Official podium must contain three different drivers';
  end if;

  if exists (
    select 1
    from public.bonus_questions question
    where question.race_id = p_race_id
      and question.is_active
      and not exists (
        select 1
        from public.race_bonus_answers answer
        join public.bonus_options option
          on option.id = answer.correct_bonus_option_id
         and option.bonus_question_id = question.id
        where answer.race_id = p_race_id
          and answer.bonus_question_id = question.id
      )
  ) then
    raise exception 'Save every official bonus answer before scoring';
  end if;

  delete from public.user_race_scores
  where race_id = p_race_id;

  insert into public.user_race_scores (
    user_id,
    race_id,
    podium_points,
    bonus_points,
    total_points,
    exact_hits,
    calculated_at
  )
  select
    prediction.user_id,
    p_race_id,
    (
      case
        when prediction.p1_driver_id = result_record.p1_driver_id then 3
        when prediction.p1_driver_id = any(array[result_record.p1_driver_id, result_record.p2_driver_id, result_record.p3_driver_id]) then 1
        else 0
      end
      +
      case
        when prediction.p2_driver_id = result_record.p2_driver_id then 3
        when prediction.p2_driver_id = any(array[result_record.p1_driver_id, result_record.p2_driver_id, result_record.p3_driver_id]) then 1
        else 0
      end
      +
      case
        when prediction.p3_driver_id = result_record.p3_driver_id then 3
        when prediction.p3_driver_id = any(array[result_record.p1_driver_id, result_record.p2_driver_id, result_record.p3_driver_id]) then 1
        else 0
      end
    )::integer as podium_points,
    coalesce((
      select sum(question.points)
      from public.prediction_bonus_answers prediction_answer
      join public.race_bonus_answers official_answer
        on official_answer.race_id = p_race_id
       and official_answer.bonus_question_id = prediction_answer.bonus_question_id
       and official_answer.correct_bonus_option_id = prediction_answer.bonus_option_id
      join public.bonus_questions question
        on question.id = prediction_answer.bonus_question_id
       and question.race_id = p_race_id
       and question.is_active
       and (
         question.tenant_id is null
         or question.tenant_id = prediction_owner.tenant_id
       )
      where prediction_answer.prediction_id = prediction.id
    ), 0)::integer as bonus_points,
    (
      (
        case
          when prediction.p1_driver_id = result_record.p1_driver_id then 3
          when prediction.p1_driver_id = any(array[result_record.p1_driver_id, result_record.p2_driver_id, result_record.p3_driver_id]) then 1
          else 0
        end
        +
        case
          when prediction.p2_driver_id = result_record.p2_driver_id then 3
          when prediction.p2_driver_id = any(array[result_record.p1_driver_id, result_record.p2_driver_id, result_record.p3_driver_id]) then 1
          else 0
        end
        +
        case
          when prediction.p3_driver_id = result_record.p3_driver_id then 3
          when prediction.p3_driver_id = any(array[result_record.p1_driver_id, result_record.p2_driver_id, result_record.p3_driver_id]) then 1
          else 0
        end
      )
      +
      coalesce((
        select sum(question.points)
        from public.prediction_bonus_answers prediction_answer
        join public.race_bonus_answers official_answer
          on official_answer.race_id = p_race_id
         and official_answer.bonus_question_id = prediction_answer.bonus_question_id
         and official_answer.correct_bonus_option_id = prediction_answer.bonus_option_id
        join public.bonus_questions question
          on question.id = prediction_answer.bonus_question_id
         and question.race_id = p_race_id
         and question.is_active
         and (
           question.tenant_id is null
           or question.tenant_id = prediction_owner.tenant_id
         )
        where prediction_answer.prediction_id = prediction.id
      ), 0)
    )::integer as total_points,
    (
      (case when prediction.p1_driver_id = result_record.p1_driver_id then 1 else 0 end)
      +
      (case when prediction.p2_driver_id = result_record.p2_driver_id then 1 else 0 end)
      +
      (case when prediction.p3_driver_id = result_record.p3_driver_id then 1 else 0 end)
    )::integer as exact_hits,
    timezone('utc'::text, now())
  from public.predictions prediction
  join public.profiles prediction_owner
    on prediction_owner.id = prediction.user_id
  where prediction.race_id = p_race_id;

  update public.races
  set status = 'scored'
  where id = p_race_id;

  perform public.rebuild_leaderboard_cache_for_season_internal(race_record.season);

  return query
  select
    race_record.season,
    count(*)::integer
  from public.predictions
  where race_id = p_race_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.save_official_race_result(
  p_race_id uuid,
  p_p1_driver_id uuid,
  p_p2_driver_id uuid,
  p_p3_driver_id uuid,
  p_bonus_question_ids uuid[],
  p_bonus_option_ids uuid[]
)
returns void as $$
declare
  expected_bonus_count integer;
  supplied_bonus_count integer;
begin
  if not public.can_manage_result_pipeline() then
    raise exception 'Platform admin access required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.races
    where id = p_race_id
  ) then
    raise exception 'Race not found';
  end if;

  if p_p1_driver_id = p_p2_driver_id
    or p_p1_driver_id = p_p3_driver_id
    or p_p2_driver_id = p_p3_driver_id
  then
    raise exception 'Official podium must contain three different drivers';
  end if;

  supplied_bonus_count := coalesce(array_length(p_bonus_question_ids, 1), 0);

  if supplied_bonus_count <> coalesce(array_length(p_bonus_option_ids, 1), 0) then
    raise exception 'Official bonus questions and answers do not match';
  end if;

  select count(*)::integer
  into expected_bonus_count
  from public.bonus_questions
  where race_id = p_race_id
    and tenant_id is null
    and is_active;

  if supplied_bonus_count <> expected_bonus_count then
    raise exception 'Save every global bonus answer before publishing results';
  end if;

  if supplied_bonus_count <> (
    select count(distinct question_id)::integer
    from unnest(p_bonus_question_ids) as supplied(question_id)
  ) then
    raise exception 'Each official bonus question can only be answered once';
  end if;

  if exists (
    select 1
    from generate_subscripts(p_bonus_question_ids, 1) as supplied(position)
    left join public.bonus_questions question
      on question.id = p_bonus_question_ids[supplied.position]
     and question.race_id = p_race_id
     and question.tenant_id is null
     and question.is_active
    left join public.bonus_options option
      on option.id = p_bonus_option_ids[supplied.position]
     and option.bonus_question_id = question.id
    where question.id is null
      or option.id is null
  ) then
    raise exception 'Official bonus answer does not match a global race question';
  end if;

  insert into public.race_results (
    race_id,
    p1_driver_id,
    p2_driver_id,
    p3_driver_id,
    source,
    entered_by,
    entered_at
  )
  values (
    p_race_id,
    p_p1_driver_id,
    p_p2_driver_id,
    p_p3_driver_id,
    'manual',
    auth.uid(),
    timezone('utc'::text, now())
  )
  on conflict (race_id) do update
  set
    p1_driver_id = excluded.p1_driver_id,
    p2_driver_id = excluded.p2_driver_id,
    p3_driver_id = excluded.p3_driver_id,
    source = excluded.source,
    entered_by = excluded.entered_by,
    entered_at = excluded.entered_at;

  delete from public.race_bonus_answers answer
  using public.bonus_questions question
  where answer.race_id = p_race_id
    and question.id = answer.bonus_question_id
    and question.tenant_id is null;

  insert into public.race_bonus_answers (
    race_id,
    bonus_question_id,
    correct_bonus_option_id
  )
  select
    p_race_id,
    p_bonus_question_ids[supplied.position],
    p_bonus_option_ids[supplied.position]
  from generate_subscripts(p_bonus_question_ids, 1) as supplied(position);

  insert into public.official_result_audit (
    race_id,
    p1_driver_id,
    p2_driver_id,
    p3_driver_id,
    source,
    bonus_answers,
    changed_by
  )
  values (
    p_race_id,
    p_p1_driver_id,
    p_p2_driver_id,
    p_p3_driver_id,
    'manual',
    coalesce((
      select jsonb_object_agg(
        p_bonus_question_ids[supplied.position]::text,
        p_bonus_option_ids[supplied.position]::text
      )
      from generate_subscripts(p_bonus_question_ids, 1) as supplied(position)
    ), '{}'::jsonb),
    auth.uid()
  );

  perform public.invalidate_race_scores_internal(p_race_id);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.save_tenant_race_bonus_answers(
  p_race_id uuid,
  p_bonus_question_ids uuid[],
  p_bonus_option_ids uuid[]
)
returns void as $$
declare
  expected_bonus_count integer;
  supplied_bonus_count integer;
  scope_tenant_id uuid;
begin
  scope_tenant_id := public.current_user_tenant_id();

  if scope_tenant_id is null then
    raise exception 'Choose a group before saving group bonus answers' using errcode = '42501';
  end if;

  if not public.is_platform_admin()
    and scope_tenant_id is distinct from public.current_admin_tenant_id()
  then
    raise exception 'Group admin access required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.races
    where id = p_race_id
  ) then
    raise exception 'Race not found';
  end if;

  supplied_bonus_count := coalesce(array_length(p_bonus_question_ids, 1), 0);

  if supplied_bonus_count <> coalesce(array_length(p_bonus_option_ids, 1), 0) then
    raise exception 'Group bonus questions and answers do not match';
  end if;

  select count(*)::integer
  into expected_bonus_count
  from public.bonus_questions
  where race_id = p_race_id
    and tenant_id = scope_tenant_id
    and is_active;

  if supplied_bonus_count <> expected_bonus_count then
    raise exception 'Save every group bonus answer before publishing scores';
  end if;

  if supplied_bonus_count <> (
    select count(distinct question_id)::integer
    from unnest(p_bonus_question_ids) as supplied(question_id)
  ) then
    raise exception 'Each group bonus question can only be answered once';
  end if;

  if exists (
    select 1
    from generate_subscripts(p_bonus_question_ids, 1) as supplied(position)
    left join public.bonus_questions question
      on question.id = p_bonus_question_ids[supplied.position]
     and question.race_id = p_race_id
     and question.tenant_id = scope_tenant_id
     and question.is_active
    left join public.bonus_options option
      on option.id = p_bonus_option_ids[supplied.position]
     and option.bonus_question_id = question.id
    where question.id is null
      or option.id is null
  ) then
    raise exception 'Group bonus answer does not match this race and group';
  end if;

  delete from public.race_bonus_answers answer
  using public.bonus_questions question
  where answer.race_id = p_race_id
    and question.id = answer.bonus_question_id
    and question.tenant_id = scope_tenant_id;

  insert into public.race_bonus_answers (
    race_id,
    bonus_question_id,
    correct_bonus_option_id
  )
  select
    p_race_id,
    p_bonus_question_ids[supplied.position],
    p_bonus_option_ids[supplied.position]
  from generate_subscripts(p_bonus_question_ids, 1) as supplied(position);

  insert into public.tenant_bonus_answer_audit (
    race_id,
    tenant_id,
    bonus_answers,
    changed_by
  )
  values (
    p_race_id,
    scope_tenant_id,
    coalesce((
      select jsonb_object_agg(
        p_bonus_question_ids[supplied.position]::text,
        p_bonus_option_ids[supplied.position]::text
      )
      from generate_subscripts(p_bonus_question_ids, 1) as supplied(position)
    ), '{}'::jsonb),
    auth.uid()
  );

  perform public.invalidate_race_scores_internal(p_race_id);
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.save_tenant_race_bonus_answers(uuid, uuid[], uuid[]) from public;
grant execute on function public.save_tenant_race_bonus_answers(uuid, uuid[], uuid[]) to authenticated, service_role;

create or replace function public.save_historic_prediction(
  p_race_id uuid,
  p_user_id uuid,
  p_p1_driver_id uuid,
  p_p2_driver_id uuid,
  p_p3_driver_id uuid,
  p_bonus_question_ids uuid[],
  p_bonus_option_ids uuid[]
)
returns boolean as $$
declare
  v_prediction_id uuid;
  v_user_tenant_id uuid;
  supplied_bonus_count integer;
begin
  if not public.can_manage_result_pipeline() then
    raise exception 'Platform admin access required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.races
    where id = p_race_id
  ) then
    raise exception 'Race not found';
  end if;

  select tenant_id
  into v_user_tenant_id
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;

  if p_p1_driver_id = p_p2_driver_id
    or p_p1_driver_id = p_p3_driver_id
    or p_p2_driver_id = p_p3_driver_id
  then
    raise exception 'Historic podium must contain three different drivers';
  end if;

  supplied_bonus_count := coalesce(array_length(p_bonus_question_ids, 1), 0);

  if supplied_bonus_count <> coalesce(array_length(p_bonus_option_ids, 1), 0) then
    raise exception 'Historic bonus questions and answers do not match';
  end if;

  if supplied_bonus_count <> (
    select count(distinct question_id)::integer
    from unnest(p_bonus_question_ids) as supplied(question_id)
  ) then
    raise exception 'Each historic bonus question can only be answered once';
  end if;

  if exists (
    select 1
    from generate_subscripts(p_bonus_question_ids, 1) as supplied(position)
    left join public.bonus_questions question
      on question.id = p_bonus_question_ids[supplied.position]
     and question.race_id = p_race_id
     and question.is_active
     and (
       question.tenant_id is null
       or question.tenant_id = v_user_tenant_id
     )
    left join public.bonus_options option
      on option.id = p_bonus_option_ids[supplied.position]
     and option.bonus_question_id = question.id
    where question.id is null
      or option.id is null
  ) then
    raise exception 'Historic bonus answer does not match the race, group, and question';
  end if;

  insert into public.predictions (
    user_id,
    race_id,
    p1_driver_id,
    p2_driver_id,
    p3_driver_id,
    submitted_at,
    updated_at
  )
  values (
    p_user_id,
    p_race_id,
    p_p1_driver_id,
    p_p2_driver_id,
    p_p3_driver_id,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  on conflict (user_id, race_id) do update
  set
    p1_driver_id = excluded.p1_driver_id,
    p2_driver_id = excluded.p2_driver_id,
    p3_driver_id = excluded.p3_driver_id,
    updated_at = excluded.updated_at
  returning id into v_prediction_id;

  delete from public.prediction_bonus_answers
  where prediction_bonus_answers.prediction_id = v_prediction_id;

  insert into public.prediction_bonus_answers (
    prediction_id,
    bonus_question_id,
    bonus_option_id
  )
  select
    v_prediction_id,
    p_bonus_question_ids[supplied.position],
    p_bonus_option_ids[supplied.position]
  from generate_subscripts(p_bonus_question_ids, 1) as supplied(position);

  insert into public.historic_prediction_audit (
    prediction_id,
    race_id,
    user_id,
    changed_by,
    bonus_answer_count
  )
  values (
    v_prediction_id,
    p_race_id,
    p_user_id,
    auth.uid(),
    supplied_bonus_count
  );

  perform public.invalidate_race_scores_internal(p_race_id);

  return exists (
    select 1
    from public.race_results
    where race_id = p_race_id
  )
  and not exists (
    select 1
    from public.bonus_questions question
    where question.race_id = p_race_id
      and question.is_active
      and not exists (
        select 1
        from public.race_bonus_answers answer
        join public.bonus_options option
          on option.id = answer.correct_bonus_option_id
         and option.bonus_question_id = question.id
        where answer.race_id = p_race_id
          and answer.bonus_question_id = question.id
      )
  );
end;
$$ language plpgsql security definer set search_path = public;
