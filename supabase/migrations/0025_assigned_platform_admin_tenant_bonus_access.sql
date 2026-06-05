create or replace function public.current_admin_tenant_id()
returns uuid as $$
  select tenant_id
  from public.profiles
  where id = auth.uid()
    and role = 'admin'
    and tenant_id is not null
$$ language sql security definer;

create or replace function public.can_read_bonus_question(question_tenant_id uuid)
returns boolean as $$
  select question_tenant_id is not null
    and (
      question_tenant_id = public.current_user_tenant_id()
      or (
        public.is_platform_admin()
        and public.current_admin_tenant_id() is null
      )
    );
$$ language sql stable security definer set search_path = public;

create or replace function public.can_manage_bonus_question(question_tenant_id uuid)
returns boolean as $$
  select question_tenant_id is not null
    and (
      question_tenant_id = public.current_admin_tenant_id()
      or (
        public.is_platform_admin()
        and public.current_admin_tenant_id() is null
      )
    );
$$ language sql stable security definer set search_path = public;

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

  if (
    public.is_platform_admin()
    and public.current_admin_tenant_id() is null
  ) or coalesce(auth.role() = 'service_role', false) then
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

create or replace function public.enforce_bonus_option_write_window()
returns trigger as $$
declare
  race_record public.races%rowtype;
  target_question_id uuid;
  question_record public.bonus_questions%rowtype;
begin
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
    if tg_op = 'DELETE' and (
      (
        public.is_platform_admin()
        and public.current_admin_tenant_id() is null
      )
      or coalesce(auth.role() = 'service_role', false)
    ) then
      return old;
    end if;

    raise exception 'Bonus options must belong to a group bonus question';
  end if;

  if (
    public.is_platform_admin()
    and public.current_admin_tenant_id() is null
  ) or coalesce(auth.role() = 'service_role', false) then
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

  perform public.invalidate_race_scores_internal(p_race_id);
end;
$$ language plpgsql security definer set search_path = public;
