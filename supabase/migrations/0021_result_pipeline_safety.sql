create or replace function public.can_manage_result_pipeline()
returns boolean as $$
  select public.is_platform_admin()
    or coalesce(auth.role() = 'service_role', false);
$$ language sql stable security definer set search_path = public;

drop policy if exists "Admins can do everything on constructors" on public.constructors;
create policy "Platform admins can manage constructors"
on public.constructors for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Admins can do everything on drivers" on public.drivers;
create policy "Platform admins can manage drivers"
on public.drivers for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Admins can do everything on circuits" on public.circuits;
create policy "Platform admins can manage circuits"
on public.circuits for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Admins can do everything on races" on public.races;
create policy "Platform admins can manage races"
on public.races for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Admins can do everything on bonus_questions" on public.bonus_questions;
create policy "Platform admins can manage bonus questions"
on public.bonus_questions for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Admins can do everything on bonus_options" on public.bonus_options;
create policy "Platform admins can manage bonus options"
on public.bonus_options for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Admins can do everything on race_results" on public.race_results;
create policy "Platform admins can manage race results"
on public.race_results for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Admins can do everything on race_bonus_answers" on public.race_bonus_answers;
create policy "Platform admins can manage race bonus answers"
on public.race_bonus_answers for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Admins can do everything on leaderboard_cache" on public.leaderboard_cache;
create policy "Platform admins can manage leaderboard cache"
on public.leaderboard_cache for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

create table public.official_result_audit (
  id uuid default gen_random_uuid() primary key,
  race_id uuid references public.races on delete cascade not null,
  p1_driver_id uuid references public.drivers not null,
  p2_driver_id uuid references public.drivers not null,
  p3_driver_id uuid references public.drivers not null,
  source text not null,
  bonus_answers jsonb default '{}'::jsonb not null,
  changed_by uuid references public.profiles on delete set null,
  changed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.official_result_audit enable row level security;

create policy "Platform admins can read official result audit"
on public.official_result_audit for select
using (public.is_platform_admin());

create table public.historic_prediction_audit (
  id uuid default gen_random_uuid() primary key,
  prediction_id uuid references public.predictions on delete set null,
  race_id uuid references public.races on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  changed_by uuid references public.profiles on delete set null,
  bonus_answer_count integer default 0 not null,
  changed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.historic_prediction_audit enable row level security;

create policy "Platform admins can read historic prediction audit"
on public.historic_prediction_audit for select
using (public.is_platform_admin());

create or replace function public.enforce_prediction_write_window()
returns trigger as $$
declare
  race_record public.races%rowtype;
  target_race_id uuid;
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  if public.can_manage_result_pipeline() then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.race_id <> old.race_id then
      raise exception 'Predictions cannot be moved between races';
    end if;
  end if;

  target_race_id := case when tg_op = 'DELETE' then old.race_id else new.race_id end;

  select *
  into race_record
  from public.races
  where id = target_race_id;

  if not found then
    raise exception 'Race not found';
  end if;

  if race_record.status in ('completed', 'scored', 'cancelled')
    or timezone('utc'::text, now()) >= race_record.prediction_lock_at
  then
    raise exception 'Predictions for this race are locked';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists enforce_prediction_write_window on public.predictions;
create trigger enforce_prediction_write_window
before insert or update or delete on public.predictions
for each row execute procedure public.enforce_prediction_write_window();

create or replace function public.enforce_prediction_bonus_write_window()
returns trigger as $$
declare
  race_record public.races%rowtype;
  target_prediction_id uuid;
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  if public.can_manage_result_pipeline() then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.prediction_id <> old.prediction_id then
      raise exception 'Bonus answers cannot be moved between predictions';
    end if;
  end if;

  target_prediction_id := case when tg_op = 'DELETE' then old.prediction_id else new.prediction_id end;

  select race.*
  into race_record
  from public.predictions prediction
  join public.races race on race.id = prediction.race_id
  where prediction.id = target_prediction_id;

  if not found then
    raise exception 'Prediction race not found';
  end if;

  if race_record.status in ('completed', 'scored', 'cancelled')
    or timezone('utc'::text, now()) >= race_record.prediction_lock_at
  then
    raise exception 'Bonus answers for this race are locked';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists enforce_prediction_bonus_write_window on public.prediction_bonus_answers;
create trigger enforce_prediction_bonus_write_window
before insert or update or delete on public.prediction_bonus_answers
for each row execute procedure public.enforce_prediction_bonus_write_window();

create or replace function public.validate_prediction_bonus_answer()
returns trigger as $$
begin
  if not exists (
    select 1
    from public.predictions p
    join public.bonus_questions q
      on q.id = new.bonus_question_id
     and q.race_id = p.race_id
     and q.is_active
    join public.bonus_options o
      on o.id = new.bonus_option_id
     and o.bonus_question_id = q.id
    where p.id = new.prediction_id
  ) then
    raise exception 'Prediction bonus answer does not match the prediction race and question';
  end if;

  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists validate_prediction_bonus_answer_relationship on public.prediction_bonus_answers;
create trigger validate_prediction_bonus_answer_relationship
before insert or update on public.prediction_bonus_answers
for each row execute procedure public.validate_prediction_bonus_answer();

create or replace function public.validate_race_bonus_answer()
returns trigger as $$
begin
  if not exists (
    select 1
    from public.bonus_questions q
    join public.bonus_options o
      on o.id = new.correct_bonus_option_id
     and o.bonus_question_id = q.id
    where q.id = new.bonus_question_id
      and q.race_id = new.race_id
      and q.is_active
  ) then
    raise exception 'Official bonus answer does not match the race and question';
  end if;

  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists validate_race_bonus_answer_relationship on public.race_bonus_answers;
create trigger validate_race_bonus_answer_relationship
before insert or update on public.race_bonus_answers
for each row execute procedure public.validate_race_bonus_answer();

create or replace function public.rebuild_leaderboard_cache_for_season_internal(p_season integer)
returns void as $$
begin
  delete from public.leaderboard_cache
  where season = p_season;

  insert into public.leaderboard_cache (
    season,
    user_id,
    total_points,
    exact_hits,
    races_scored,
    updated_at
  )
  select
    p_season,
    scores.user_id,
    sum(scores.total_points)::integer,
    sum(scores.exact_hits)::integer,
    count(*)::integer,
    timezone('utc'::text, now())
  from public.user_race_scores scores
  join public.races race on race.id = scores.race_id
  where race.season = p_season
    and race.status = 'scored'
  group by scores.user_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.rebuild_leaderboard_cache_for_season_internal(integer) from public;

create or replace function public.invalidate_race_scores_internal(p_race_id uuid)
returns void as $$
declare
  race_record public.races%rowtype;
begin
  select *
  into race_record
  from public.races
  where id = p_race_id;

  if not found then
    raise exception 'Race not found';
  end if;

  delete from public.user_race_scores
  where race_id = p_race_id;

  if race_record.status <> 'cancelled'
    and (
      race_record.status = 'scored'
      or exists (
        select 1
        from public.race_results
        where race_id = p_race_id
      )
    )
  then
    update public.races
    set status = 'completed'
    where id = p_race_id;
  end if;

  perform public.rebuild_leaderboard_cache_for_season_internal(race_record.season);
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.invalidate_race_scores_internal(uuid) from public;

create or replace function public.invalidate_race_scores(p_race_id uuid)
returns void as $$
begin
  if not public.can_manage_result_pipeline() then
    raise exception 'Platform admin access required' using errcode = '42501';
  end if;

  perform public.invalidate_race_scores_internal(p_race_id);
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.invalidate_race_scores(uuid) from public;
grant execute on function public.invalidate_race_scores(uuid) to authenticated, service_role;

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

revoke all on function public.recalculate_race_scores_internal(uuid) from public;

create or replace function public.recalculate_race_scores(p_race_id uuid)
returns table(season integer, predictions_count integer) as $$
begin
  if not public.can_manage_result_pipeline() then
    raise exception 'Platform admin access required' using errcode = '42501';
  end if;

  return query
  select *
  from public.recalculate_race_scores_internal(p_race_id);
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.recalculate_race_scores(uuid) from public;
grant execute on function public.recalculate_race_scores(uuid) to authenticated, service_role;

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
    and is_active;

  if supplied_bonus_count <> expected_bonus_count then
    raise exception 'Save every official bonus answer before publishing results';
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
     and question.is_active
    left join public.bonus_options option
      on option.id = p_bonus_option_ids[supplied.position]
     and option.bonus_question_id = question.id
    where question.id is null
      or option.id is null
  ) then
    raise exception 'Official bonus answer does not match the race and question';
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

  delete from public.race_bonus_answers
  where race_id = p_race_id;

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

revoke all on function public.save_official_race_result(uuid, uuid, uuid, uuid, uuid[], uuid[]) from public;
grant execute on function public.save_official_race_result(uuid, uuid, uuid, uuid, uuid[], uuid[]) to authenticated, service_role;

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

  if not exists (
    select 1
    from public.profiles
    where id = p_user_id
  ) then
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
    left join public.bonus_options option
      on option.id = p_bonus_option_ids[supplied.position]
     and option.bonus_question_id = question.id
    where question.id is null
      or option.id is null
  ) then
    raise exception 'Historic bonus answer does not match the race and question';
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

revoke all on function public.save_historic_prediction(uuid, uuid, uuid, uuid, uuid, uuid[], uuid[]) from public;
grant execute on function public.save_historic_prediction(uuid, uuid, uuid, uuid, uuid, uuid[], uuid[]) to authenticated, service_role;
