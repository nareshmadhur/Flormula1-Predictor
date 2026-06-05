alter table public.bonus_options
  add column if not exists circuit_id uuid references public.circuits on delete cascade;

create index if not exists bonus_options_circuit_id_idx
on public.bonus_options (circuit_id)
where circuit_id is not null;

alter table public.bonus_options
  drop constraint if exists bonus_options_option_type_check;

alter table public.bonus_options
  add constraint bonus_options_option_type_check
  check (option_type in ('driver', 'constructor', 'circuit', 'custom_text'));

create or replace function public.validate_bonus_option_reference()
returns trigger as $$
begin
  if new.option_type = 'driver' then
    if new.driver_id is null then
      raise exception 'Driver bonus options must reference a driver';
    end if;

    if new.constructor_id is not null or new.circuit_id is not null then
      raise exception 'Driver bonus options cannot reference constructors or circuits';
    end if;
  elsif new.option_type = 'constructor' then
    if new.constructor_id is null then
      raise exception 'Constructor bonus options must reference a constructor';
    end if;

    if new.driver_id is not null or new.circuit_id is not null then
      raise exception 'Constructor bonus options cannot reference drivers or circuits';
    end if;
  elsif new.option_type = 'circuit' then
    if new.circuit_id is null then
      raise exception 'Venue bonus options must reference a circuit';
    end if;

    if new.driver_id is not null or new.constructor_id is not null then
      raise exception 'Venue bonus options cannot reference drivers or constructors';
    end if;

    if btrim(coalesce(new.label, '')) = '' then
      raise exception 'Venue bonus options must keep a display label';
    end if;
  elsif new.option_type = 'custom_text' then
    if btrim(coalesce(new.label, '')) = '' then
      raise exception 'Custom bonus options must keep a display label';
    end if;

    if new.driver_id is not null or new.constructor_id is not null or new.circuit_id is not null then
      raise exception 'Custom bonus options cannot reference drivers, constructors, or circuits';
    end if;
  else
    raise exception 'Unsupported bonus option type';
  end if;

  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists validate_bonus_option_reference on public.bonus_options;
create trigger validate_bonus_option_reference
before insert or update on public.bonus_options
for each row execute procedure public.validate_bonus_option_reference();
