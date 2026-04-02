alter table public.races
  add column if not exists schedule_source text;

update public.races
set schedule_source = 'manual'
where schedule_source is null;

alter table public.races
  alter column schedule_source set default 'manual',
  alter column schedule_source set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'races_schedule_source_check'
  ) then
    alter table public.races
      add constraint races_schedule_source_check
      check (schedule_source in ('manual', 'openf1'));
  end if;
end $$;

alter table public.races
  add column if not exists schedule_source_url text,
  add column if not exists schedule_synced_at timestamp with time zone;
