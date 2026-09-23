-- Numeric bonus answers are additive. Existing choice questions keep their
-- answer_type default, existing option ids remain unchanged, and no historical
-- answer rows are rewritten.

alter table public.bonus_questions
  add column if not exists answer_type text not null default 'choice';

alter table public.bonus_questions
  drop constraint if exists bonus_questions_answer_type_check;

alter table public.bonus_questions
  add constraint bonus_questions_answer_type_check
  check (answer_type in ('choice', 'numeric'));

alter table public.prediction_bonus_answers
  add column if not exists numeric_value numeric;

alter table public.prediction_bonus_answers
  alter column bonus_option_id drop not null;

alter table public.prediction_bonus_answers
  drop constraint if exists prediction_bonus_answers_value_check;

alter table public.prediction_bonus_answers
  add constraint prediction_bonus_answers_value_check
  check (
    (
      bonus_option_id is not null
      and numeric_value is null
    )
    or (
      bonus_option_id is null
      and numeric_value is not null
      and numeric_value >= 0
      and numeric_value::text not in ('NaN', 'Infinity', '-Infinity')
    )
  );

alter table public.race_bonus_answers
  add column if not exists numeric_value numeric;

alter table public.race_bonus_answers
  alter column correct_bonus_option_id drop not null;

alter table public.race_bonus_answers
  drop constraint if exists race_bonus_answers_value_check;

alter table public.race_bonus_answers
  add constraint race_bonus_answers_value_check
  check (
    (
      correct_bonus_option_id is not null
      and numeric_value is null
    )
    or (
      correct_bonus_option_id is null
      and numeric_value is not null
      and numeric_value >= 0
      and numeric_value::text not in ('NaN', 'Infinity', '-Infinity')
    )
  );

create or replace function public.bonus_answer_values_match(
  p_answer_type text,
  p_prediction_option_id uuid,
  p_prediction_numeric_value numeric,
  p_official_option_id uuid,
  p_official_numeric_value numeric
)
returns boolean as $$
  select case
    when p_answer_type = 'numeric' then
      p_prediction_numeric_value is not null
      and p_official_numeric_value is not null
      and p_prediction_numeric_value = p_official_numeric_value
    else
      p_prediction_option_id is not null
      and p_official_option_id is not null
      and p_prediction_option_id = p_official_option_id
  end;
$$ language sql immutable set search_path = public;

create or replace function public.enforce_bonus_question_write_window()
returns trigger as $$
declare
  race_record public.races%rowtype;
  target_race_id uuid;
  target_tenant_id uuid;
begin
  if tg_op in ('INSERT', 'UPDATE') and new.tenant_id is null then
    raise exception 'Group bonus questions must belong to a group';
  end if;

  if tg_op = 'UPDATE' and (
    new.race_id <> old.race_id
    or new.tenant_id is distinct from old.tenant_id
  ) then
    raise exception 'Group bonus questions cannot be moved between races or groups';
  end if;

  if tg_op = 'UPDATE'
    and new.answer_type is distinct from old.answer_type
    and exists (
      select 1
      from public.bonus_options
      where bonus_question_id = old.id
    )
  then
    raise exception 'A bonus question with options cannot change answer type';
  end if;

  target_race_id := case when tg_op = 'DELETE' then old.race_id else new.race_id end;
  target_tenant_id := case when tg_op = 'DELETE' then old.tenant_id else new.tenant_id end;

  if target_tenant_id is null then
    raise exception 'Group bonus questions must belong to a group';
  end if;

  -- Once a question participates in an answer or score, its identity and
  -- configuration are immutable. This prevents the existing cascading foreign
  -- keys from erasing or changing historical results.
  if tg_op in ('UPDATE', 'DELETE') and (
    exists (
      select 1
      from public.prediction_bonus_answers
      where bonus_question_id = old.id
    )
    or exists (
      select 1
      from public.race_bonus_answers
      where bonus_question_id = old.id
    )
    or exists (
      select 1
      from public.user_race_scores
      where race_id = old.race_id
    )
  ) then
    raise exception 'Bonus questions with answers or scores are immutable';
  end if;

  -- Platform/service inserts are allowed after prediction lock so an
  -- administrator can safely backfill a question without reopening entries.
  if (
    public.is_platform_admin()
    or coalesce(auth.role() = 'service_role', false)
    or current_user in ('postgres', 'supabase_admin')
  ) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
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

create or replace function public.enforce_bonus_option_write_window()
returns trigger as $$
declare
  race_record public.races%rowtype;
  target_question_id uuid;
  question_record public.bonus_questions%rowtype;
begin
  -- A question delete cascades to its options. The foreign-key cascade fires
  -- this trigger after the parent row is gone, so the question lookup below
  -- would otherwise reject a valid delete with "Bonus question not found".
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
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
    raise exception 'Bonus options must belong to a group bonus question';
  end if;

  if tg_op in ('INSERT', 'UPDATE') and question_record.answer_type = 'numeric' then
    raise exception 'Numeric bonus questions cannot have answer options';
  end if;

  if tg_op in ('UPDATE', 'DELETE') and (
    exists (
      select 1
      from public.prediction_bonus_answers
      where bonus_option_id = old.id
    )
    or exists (
      select 1
      from public.race_bonus_answers
      where correct_bonus_option_id = old.id
    )
    or exists (
      select 1
      from public.user_race_scores
      where race_id = question_record.race_id
    )
  ) then
    raise exception 'Bonus options with answers or scores are immutable';
  end if;

  if (
    public.is_platform_admin()
    or coalesce(auth.role() = 'service_role', false)
    or current_user in ('postgres', 'supabase_admin')
  ) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
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
     and question.tenant_id = owner.tenant_id
    where prediction.id = new.prediction_id
      and (
        (
          question.answer_type = 'choice'
          and new.bonus_option_id is not null
          and new.numeric_value is null
          and exists (
            select 1
            from public.bonus_options option
            where option.id = new.bonus_option_id
              and option.bonus_question_id = question.id
          )
        )
        or (
          question.answer_type = 'numeric'
          and new.bonus_option_id is null
          and new.numeric_value is not null
        )
      )
  ) then
    raise exception 'Prediction bonus answer does not match the prediction race, group, and question';
  end if;

  return new;
end;
$$ language plpgsql set search_path = public;

create or replace function public.validate_race_bonus_answer()
returns trigger as $$
begin
  if not exists (
    select 1
    from public.bonus_questions question
    where question.id = new.bonus_question_id
      and question.race_id = new.race_id
      and question.is_active
      and (
        (
          question.answer_type = 'choice'
          and new.correct_bonus_option_id is not null
          and new.numeric_value is null
          and exists (
            select 1
            from public.bonus_options option
            where option.id = new.correct_bonus_option_id
              and option.bonus_question_id = question.id
          )
        )
        or (
          question.answer_type = 'numeric'
          and new.correct_bonus_option_id is null
          and new.numeric_value is not null
        )
      )
  ) then
    raise exception 'Official bonus answer does not match the race and question';
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

  delete from public.user_race_scores
  where race_id = p_race_id;

  with scored_predictions as (
    select
      prediction.user_id,
      prediction.id,
      prediction_owner.tenant_id,
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
        join public.bonus_questions question
          on question.id = prediction_answer.bonus_question_id
         and question.race_id = p_race_id
         and question.is_active
         and question.tenant_id = prediction_owner.tenant_id
        where prediction_answer.prediction_id = prediction.id
          and public.bonus_answer_values_match(
            question.answer_type,
            prediction_answer.bonus_option_id,
            prediction_answer.numeric_value,
            official_answer.correct_bonus_option_id,
            official_answer.numeric_value
          )
      ), 0)::integer as bonus_points,
      (
        case when prediction.p1_driver_id = result_record.p1_driver_id then 1 else 0 end
        +
        case when prediction.p2_driver_id = result_record.p2_driver_id then 1 else 0 end
        +
        case when prediction.p3_driver_id = result_record.p3_driver_id then 1 else 0 end
      )::integer as exact_hits
    from public.predictions prediction
    join public.profiles prediction_owner
      on prediction_owner.id = prediction.user_id
    where prediction.race_id = p_race_id
  )
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
    user_id,
    p_race_id,
    podium_points,
    bonus_points,
    podium_points + bonus_points,
    exact_hits,
    timezone('utc'::text, now())
  from scored_predictions;

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

create or replace function public.save_tenant_race_bonus_answers_v2(
  p_race_id uuid,
  p_bonus_answers jsonb
)
returns void as $$
declare
  v_answers jsonb := coalesce(p_bonus_answers, '[]'::jsonb);
  expected_bonus_count integer;
  supplied_bonus_count integer;
  scope_tenant_id uuid;
  supplied_tenant_ids uuid[];
begin
  if not exists (
    select 1
    from public.races
    where id = p_race_id
  ) then
    raise exception 'Race not found';
  end if;

  if jsonb_typeof(v_answers) <> 'array' then
    raise exception 'Group bonus answers must be an array';
  end if;

  supplied_bonus_count := jsonb_array_length(v_answers);
  scope_tenant_id := public.current_admin_tenant_id();

  if scope_tenant_id is null
    and (
      public.is_platform_admin()
      or coalesce(auth.role() = 'service_role', false)
    )
    and supplied_bonus_count > 0
  then
    select array_agg(distinct question.tenant_id)
    into supplied_tenant_ids
    from public.bonus_questions question
    join jsonb_to_recordset(v_answers) as submitted(
      question_id uuid,
      option_id uuid,
      numeric_value numeric
    )
      on submitted.question_id = question.id
    where question.race_id = p_race_id
      and question.is_active;

    if coalesce(array_length(supplied_tenant_ids, 1), 0) <> 1
      or supplied_tenant_ids[1] is null
    then
      raise exception 'Platform bonus support updates must target exactly one group';
    end if;

    scope_tenant_id := supplied_tenant_ids[1];
  end if;

  if scope_tenant_id is null then
    raise exception 'Choose a group before saving group bonus answers' using errcode = '42501';
  end if;

  if not (
    scope_tenant_id = public.current_admin_tenant_id()
    or public.is_platform_admin()
    or coalesce(auth.role() = 'service_role', false)
  ) then
    raise exception 'Group admin access required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('flormula1:tenant-bonus:' || p_race_id::text, 0)
  );

  select count(*)::integer
  into expected_bonus_count
  from public.bonus_questions
  where race_id = p_race_id
    and tenant_id = scope_tenant_id
    and is_active;

  if supplied_bonus_count <> expected_bonus_count then
    raise exception 'Save every group bonus answer before publishing scores';
  end if;

  if supplied_bonus_count > 0 and supplied_bonus_count <> (
    select count(distinct submitted.question_id)::integer
    from jsonb_to_recordset(v_answers) as submitted(
      question_id uuid,
      option_id uuid,
      numeric_value numeric
    )
  ) then
    raise exception 'Each group bonus question can only be answered once';
  end if;

  if supplied_bonus_count > 0 and exists (
    select 1
    from jsonb_to_recordset(v_answers) as submitted(
      question_id uuid,
      option_id uuid,
      numeric_value numeric
    )
    left join public.bonus_questions question
      on question.id = submitted.question_id
     and question.race_id = p_race_id
     and question.tenant_id = scope_tenant_id
     and question.is_active
    left join public.bonus_options option
      on option.id = submitted.option_id
     and option.bonus_question_id = question.id
    where question.id is null
      or (
        question.answer_type = 'choice'
        and (
          submitted.option_id is null
          or submitted.numeric_value is not null
          or option.id is null
        )
      )
      or (
        question.answer_type = 'numeric'
        and (
          submitted.option_id is not null
          or submitted.numeric_value is null
          or submitted.numeric_value < 0
          or submitted.numeric_value::text in ('NaN', 'Infinity', '-Infinity')
        )
      )
  ) then
    raise exception 'Group bonus answer does not match this race and group';
  end if;

  if (
    select count(*)::integer
    from public.race_bonus_answers answer
    join public.bonus_questions question
      on question.id = answer.bonus_question_id
    where answer.race_id = p_race_id
      and question.tenant_id = scope_tenant_id
  ) = supplied_bonus_count
  and not exists (
    select 1
    from jsonb_to_recordset(v_answers) as submitted(
      question_id uuid,
      option_id uuid,
      numeric_value numeric
    )
    left join public.race_bonus_answers answer
      on answer.race_id = p_race_id
     and answer.bonus_question_id = submitted.question_id
    where answer.id is null
      or answer.correct_bonus_option_id is distinct from submitted.option_id
      or answer.numeric_value is distinct from submitted.numeric_value
  ) then
    return;
  end if;

  delete from public.race_bonus_answers answer
  using public.bonus_questions question
  where answer.race_id = p_race_id
    and question.id = answer.bonus_question_id
    and question.tenant_id = scope_tenant_id;

  insert into public.race_bonus_answers (
    race_id,
    bonus_question_id,
    correct_bonus_option_id,
    numeric_value
  )
  select
    p_race_id,
    submitted.question_id,
    case when question.answer_type = 'choice' then submitted.option_id else null end,
    case when question.answer_type = 'numeric' then submitted.numeric_value else null end
  from jsonb_to_recordset(v_answers) as submitted(
    question_id uuid,
    option_id uuid,
    numeric_value numeric
  )
  join public.bonus_questions question
    on question.id = submitted.question_id;

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
        submitted.question_id::text,
        case
          when question.answer_type = 'numeric'
            then jsonb_build_object('numeric_value', submitted.numeric_value)
          else jsonb_build_object('option_id', submitted.option_id)
        end
      )
      from jsonb_to_recordset(v_answers) as submitted(
        question_id uuid,
        option_id uuid,
        numeric_value numeric
      )
      join public.bonus_questions question
        on question.id = submitted.question_id
    ), '{}'::jsonb),
    auth.uid()
  );

  if exists (
    select 1
    from public.race_results
    where race_id = p_race_id
  ) then
    perform public.recalculate_race_scores_internal(p_race_id);
  elsif exists (
    select 1
    from public.user_race_scores
    where race_id = p_race_id
  )
  or exists (
    select 1
    from public.races
    where id = p_race_id
      and status = 'scored'
  ) then
    perform public.invalidate_race_scores_internal(p_race_id);
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.save_historic_prediction_v2(
  p_race_id uuid,
  p_user_id uuid,
  p_p1_driver_id uuid,
  p_p2_driver_id uuid,
  p_p3_driver_id uuid,
  p_bonus_answers jsonb
)
returns boolean as $$
declare
  v_prediction_id uuid;
  v_user_tenant_id uuid;
  v_answers jsonb := coalesce(p_bonus_answers, '[]'::jsonb);
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

  if jsonb_typeof(v_answers) <> 'array' then
    raise exception 'Historic bonus answers must be an array';
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

  supplied_bonus_count := jsonb_array_length(v_answers);

  if supplied_bonus_count > 0 and v_user_tenant_id is null then
    raise exception 'Historic bonus answers require a group member';
  end if;

  if supplied_bonus_count > 0 and supplied_bonus_count <> (
    select count(distinct submitted.question_id)::integer
    from jsonb_to_recordset(v_answers) as submitted(
      question_id uuid,
      option_id uuid,
      numeric_value numeric
    )
  ) then
    raise exception 'Each historic bonus question can only be answered once';
  end if;

  if supplied_bonus_count > 0 and exists (
    select 1
    from jsonb_to_recordset(v_answers) as submitted(
      question_id uuid,
      option_id uuid,
      numeric_value numeric
    )
    left join public.bonus_questions question
      on question.id = submitted.question_id
     and question.race_id = p_race_id
     and question.is_active
     and question.tenant_id = v_user_tenant_id
    left join public.bonus_options option
      on option.id = submitted.option_id
     and option.bonus_question_id = question.id
    where question.id is null
      or (
        question.answer_type = 'choice'
        and (
          submitted.option_id is null
          or submitted.numeric_value is not null
          or option.id is null
        )
      )
      or (
        question.answer_type = 'numeric'
        and (
          submitted.option_id is not null
          or submitted.numeric_value is null
          or submitted.numeric_value < 0
          or submitted.numeric_value::text in ('NaN', 'Infinity', '-Infinity')
        )
      )
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

  if supplied_bonus_count > 0 then
    delete from public.prediction_bonus_answers
    where prediction_bonus_answers.prediction_id = v_prediction_id;

    insert into public.prediction_bonus_answers (
      prediction_id,
      bonus_question_id,
      bonus_option_id,
      numeric_value
    )
    select
      v_prediction_id,
      submitted.question_id,
      case when question.answer_type = 'choice' then submitted.option_id else null end,
      case when question.answer_type = 'numeric' then submitted.numeric_value else null end
    from jsonb_to_recordset(v_answers) as submitted(
      question_id uuid,
      option_id uuid,
      numeric_value numeric
    )
    join public.bonus_questions question
      on question.id = submitted.question_id;
  end if;

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
  );
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.save_tenant_race_bonus_answers_v2(uuid, jsonb) from public;
grant execute on function public.save_tenant_race_bonus_answers_v2(uuid, jsonb) to authenticated, service_role;

revoke all on function public.save_historic_prediction_v2(uuid, uuid, uuid, uuid, uuid, jsonb) from public;
grant execute on function public.save_historic_prediction_v2(uuid, uuid, uuid, uuid, uuid, jsonb) to authenticated, service_role;

-- Seed only the intended group-scoped question. The lookup is idempotent and
-- intentionally does nothing in environments without the production schedule.
do $$
declare
  madrid_race_id uuid;
  target_tenant_id uuid;
begin
  select race.id
  into madrid_race_id
  from public.races race
  join public.circuits circuit
    on circuit.id = race.circuit_id
  where lower(coalesce(circuit.city, '')) = 'madrid'
     or lower(coalesce(circuit.name, '')) like '%madr%'
  order by race.race_start_at desc nulls last, race.season desc, race.round desc
  limit 1;

  select tenant.id
  into target_tenant_id
  from public.tenants tenant
  where lower(coalesce(tenant.slug, '')) = 'nl-hq'
     or lower(coalesce(tenant.name, '')) = 'nl hoofdkantoor'
  order by case when lower(coalesce(tenant.slug, '')) = 'nl-hq' then 0 else 1 end
  limit 1;

  if madrid_race_id is null or target_tenant_id is null then
    raise notice 'Madrid numeric bonus question seed skipped: target race or group not found';
    return;
  end if;

  if not exists (
    select 1
    from public.bonus_questions
    where race_id = madrid_race_id
      and tenant_id = target_tenant_id
      and question_text = 'How many red flags will be given during the match'
  ) then
    insert into public.bonus_questions (
      race_id,
      tenant_id,
      question_text,
      points,
      display_order,
      answer_type
    )
    values (
      madrid_race_id,
      target_tenant_id,
      'How many red flags will be given during the match',
      1,
      coalesce((
        select max(display_order) + 1
        from public.bonus_questions
        where race_id = madrid_race_id
          and tenant_id = target_tenant_id
      ), 0),
      'numeric'
    );
  end if;
end;
$$;
