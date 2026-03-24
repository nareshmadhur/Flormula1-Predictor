create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  display_name text,
  email text,
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.constructors (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  short_code text not null,
  emoji text,
  logo_url text
);

create table public.drivers (
  id uuid default gen_random_uuid() primary key,
  full_name text not null,
  code text not null,
  constructor_id uuid references public.constructors on delete set null,
  emoji text,
  image_url text,
  active boolean default true not null
);

create table public.circuits (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  country text,
  city text,
  emoji text,
  image_url text,
  lat numeric,
  lng numeric
);

create table public.races (
  id uuid default gen_random_uuid() primary key,
  season integer not null,
  round integer not null,
  race_name text not null,
  circuit_id uuid references public.circuits on delete cascade not null,
  race_start_at timestamp with time zone not null,
  prediction_lock_at timestamp with time zone not null,
  status text default 'upcoming' check (status in ('upcoming', 'locked', 'completed', 'scored')),
  external_race_key text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.bonus_questions (
  id uuid default gen_random_uuid() primary key,
  race_id uuid references public.races on delete cascade not null,
  question_text text not null,
  points integer default 1 not null,
  display_order integer default 0 not null,
  is_active boolean default true not null
);

create table public.bonus_options (
  id uuid default gen_random_uuid() primary key,
  bonus_question_id uuid references public.bonus_questions on delete cascade not null,
  option_type text not null check (option_type in ('driver', 'constructor', 'custom_text')),
  driver_id uuid references public.drivers on delete cascade,
  constructor_id uuid references public.constructors on delete cascade,
  label text,
  display_order integer default 0 not null
);

create table public.predictions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  race_id uuid references public.races on delete cascade not null,
  p1_driver_id uuid references public.drivers not null,
  p2_driver_id uuid references public.drivers not null,
  p3_driver_id uuid references public.drivers not null,
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, race_id)
);

create table public.prediction_bonus_answers (
  id uuid default gen_random_uuid() primary key,
  prediction_id uuid references public.predictions on delete cascade not null,
  bonus_question_id uuid references public.bonus_questions on delete cascade not null,
  bonus_option_id uuid references public.bonus_options on delete cascade not null,
  unique (prediction_id, bonus_question_id)
);

create table public.race_results (
  id uuid default gen_random_uuid() primary key,
  race_id uuid references public.races on delete cascade not null unique,
  p1_driver_id uuid references public.drivers not null,
  p2_driver_id uuid references public.drivers not null,
  p3_driver_id uuid references public.drivers not null,
  source text default 'manual',
  entered_by uuid references public.profiles on delete set null,
  entered_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.race_bonus_answers (
  id uuid default gen_random_uuid() primary key,
  race_id uuid references public.races on delete cascade not null,
  bonus_question_id uuid references public.bonus_questions on delete cascade not null,
  correct_bonus_option_id uuid references public.bonus_options on delete cascade not null,
  unique (race_id, bonus_question_id)
);

create table public.user_race_scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  race_id uuid references public.races on delete cascade not null,
  podium_points integer default 0 not null,
  bonus_points integer default 0 not null,
  total_points integer default 0 not null,
  exact_hits integer default 0 not null,
  calculated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, race_id)
);

create table public.leaderboard_cache (
  id uuid default gen_random_uuid() primary key,
  season integer not null,
  user_id uuid references public.profiles on delete cascade not null,
  total_points integer default 0 not null,
  exact_hits integer default 0 not null,
  races_scored integer default 0 not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (season, user_id)
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.constructors enable row level security;
alter table public.drivers enable row level security;
alter table public.circuits enable row level security;
alter table public.races enable row level security;
alter table public.bonus_questions enable row level security;
alter table public.bonus_options enable row level security;
alter table public.predictions enable row level security;
alter table public.prediction_bonus_answers enable row level security;
alter table public.race_results enable row level security;
alter table public.race_bonus_answers enable row level security;
alter table public.user_race_scores enable row level security;
alter table public.leaderboard_cache enable row level security;

-- Create basic RLS policies

-- Admin logic wrapper (reusable function)
create or replace function public.is_admin()
returns boolean as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer;

-- Profiles: public read, users can update own, admins can update any
create policy "Allow public read on profiles" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Public read access tables
create policy "Allow public read on constructors" on public.constructors for select using (true);
create policy "Allow public read on drivers" on public.drivers for select using (true);
create policy "Allow public read on circuits" on public.circuits for select using (true);
create policy "Allow public read on races" on public.races for select using (true);
create policy "Allow public read on bonus_questions" on public.bonus_questions for select using (true);
create policy "Allow public read on bonus_options" on public.bonus_options for select using (true);
create policy "Allow public read on leaderboard_cache" on public.leaderboard_cache for select using (true);

-- Admin all access on public tables
create policy "Admins can do everything on constructors" on public.constructors for all using (public.is_admin());
create policy "Admins can do everything on drivers" on public.drivers for all using (public.is_admin());
create policy "Admins can do everything on circuits" on public.circuits for all using (public.is_admin());
create policy "Admins can do everything on races" on public.races for all using (public.is_admin());
create policy "Admins can do everything on bonus_questions" on public.bonus_questions for all using (public.is_admin());
create policy "Admins can do everything on bonus_options" on public.bonus_options for all using (public.is_admin());
create policy "Admins can do everything on race_results" on public.race_results for all using (public.is_admin());
create policy "Admins can do everything on race_bonus_answers" on public.race_bonus_answers for all using (public.is_admin());
create policy "Admins can do everything on leaderboard_cache" on public.leaderboard_cache for all using (public.is_admin());
create policy "Admins can do everything on user_race_scores" on public.user_race_scores for all using (public.is_admin());

-- Predictions & answers: Users can read own, insert own, update own, delete own
create policy "Users can managing own predictions" on public.predictions for all using (auth.uid() = user_id);
create policy "Admins can view all predictions" on public.predictions for select using (public.is_admin());

create policy "Users can manage own prediction answers" on public.prediction_bonus_answers for all using (
  prediction_id in (select id from public.predictions where user_id = auth.uid())
);
create policy "Admins can view all prediction answers" on public.prediction_bonus_answers for select using (public.is_admin());

-- Read user race scores: users can read own, admins can read all
create policy "Users can see own scores" on public.user_race_scores for select using (auth.uid() = user_id);

-- Result tables: public read? The user said "Only admin can enter results", implies public might read results.
create policy "Allow public read on race_results" on public.race_results for select using (true);
create policy "Allow public read on race_bonus_answers" on public.race_bonus_answers for select using (true);

-- Trigger for creating user profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, email, role)
  values (new.id, new.raw_user_meta_data->>'display_name', new.email, 'user');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
