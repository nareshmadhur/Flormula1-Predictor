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
  supplied_tenant_ids uuid[];
begin
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
    where question.race_id = p_race_id
      and question.is_active
      and question.id = any(p_bonus_question_ids);

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
    select count(distinct question_id)::integer
    from unnest(p_bonus_question_ids) as supplied(question_id)
  ) then
    raise exception 'Each group bonus question can only be answered once';
  end if;

  if supplied_bonus_count > 0 and exists (
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

  if exists (
    select 1
    from public.race_results
    where race_id = p_race_id
  ) then
    perform public.recalculate_race_scores_internal(p_race_id);
  else
    perform public.invalidate_race_scores_internal(p_race_id);
  end if;
end;
$$ language plpgsql security definer set search_path = public;
