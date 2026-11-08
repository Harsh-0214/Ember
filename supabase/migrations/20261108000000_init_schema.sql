-- Ember: initial schema, RLS and storage.
-- Every user table is protected by Row Level Security limited to auth.uid().

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles & goals
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  sex text check (sex in ('male', 'female')),
  birth_date date,
  height_cm numeric(5, 1) check (height_cm between 50 and 272),
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  timezone text not null default 'America/Toronto',
  meal_names text[] not null default array['Breakfast', 'Lunch', 'Dinner', 'Snacks'],
  checkin_day smallint not null default 1 check (checkin_day between 0 and 6),
  exercise_budget_enabled boolean not null default false,
  exercise_budget_pct smallint not null default 0 check (exercise_budget_pct between 0 and 100),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  water_goal_ml integer not null default 2500 check (water_goal_ml between 0 and 10000),
  calorie_floor_kcal integer check (calorie_floor_kcal between 800 and 3000),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  effective_from date not null,
  goal_type text not null check (goal_type in ('lose', 'maintain', 'gain')),
  goal_weight_kg numeric(5, 2) check (goal_weight_kg between 20 and 400),
  -- signed: negative = loss per week
  weekly_rate_kg numeric(4, 2) not null default 0 check (weekly_rate_kg between -2 and 2),
  activity_level text not null check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  bmr_method text not null default 'mifflin' check (bmr_method in ('mifflin', 'katch')),
  tdee_kcal integer,
  kcal_target integer not null check (kcal_target between 800 and 8000),
  protein_g integer not null check (protein_g between 0 and 600),
  carbs_g integer not null check (carbs_g between 0 and 1500),
  fat_g integer not null check (fat_g between 0 and 600),
  fiber_g integer check (fiber_g between 0 and 200),
  is_manual boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, effective_from)
);
create index goals_user_date on public.goals (user_id, effective_from desc);

-- ---------------------------------------------------------------------------
-- Foods (shared cache + user custom foods)
-- ---------------------------------------------------------------------------
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  -- null = shared cache row (Open Food Facts / USDA / seed), written by service role only
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  brand text check (char_length(brand) <= 200),
  barcode text check (barcode ~ '^[0-9]{6,14}$'),
  source text not null check (source in ('custom', 'off', 'usda', 'seed', 'recipe', 'import', 'ai')),
  source_id text,
  basis text not null default 'g' check (basis in ('g', 'ml')),
  -- nutrients per 100 g (or 100 ml)
  kcal numeric(7, 2) not null check (kcal between 0 and 1000),
  protein_g numeric(6, 2) not null default 0 check (protein_g between 0 and 100),
  carbs_g numeric(6, 2) not null default 0 check (carbs_g between 0 and 100),
  fat_g numeric(6, 2) not null default 0 check (fat_g between 0 and 100),
  fiber_g numeric(6, 2) check (fiber_g between 0 and 100),
  sugar_g numeric(6, 2) check (sugar_g between 0 and 100),
  sat_fat_g numeric(6, 2) check (sat_fat_g between 0 and 100),
  sodium_mg numeric(8, 2) check (sodium_mg between 0 and 100000),
  recipe_id uuid,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index foods_shared_source on public.foods (source, source_id) where user_id is null and source_id is not null;
create index foods_barcode on public.foods (barcode) where barcode is not null;
create index foods_user on public.foods (user_id) where user_id is not null;
create index foods_name_trgm on public.foods using gin (name extensions.gin_trgm_ops);
create trigger foods_updated before update on public.foods for each row execute function public.set_updated_at();

create table public.food_servings (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  grams numeric(8, 2) not null check (grams > 0 and grams <= 10000),
  is_default boolean not null default false,
  position smallint not null default 0
);
create index food_servings_food on public.food_servings (food_id);

-- Per-user favourites for shared foods (foods.is_favorite only applies to own foods)
create table public.food_favorites (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

-- ---------------------------------------------------------------------------
-- Recipes & saved meals
-- ---------------------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  servings numeric(6, 2) not null default 1 check (servings > 0),
  -- cooked weight (optional); defaults to the sum of the ingredients
  total_grams numeric(8, 2) check (total_grams > 0),
  notes text,
  food_id uuid references public.foods (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger recipes_updated before update on public.recipes for each row execute function public.set_updated_at();
alter table public.foods add constraint foods_recipe_fk foreign key (recipe_id) references public.recipes (id) on delete cascade;

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete restrict,
  grams numeric(8, 2) not null check (grams > 0),
  serving_name text,
  quantity numeric(8, 3),
  position smallint not null default 0
);
create index recipe_items_recipe on public.recipe_items (recipe_id);

create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  default_meal smallint check (default_meal between 0 and 5),
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.saved_meal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  saved_meal_id uuid not null references public.saved_meals (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  name text not null,
  brand text,
  grams numeric(8, 2),
  serving_name text,
  quantity numeric(8, 3),
  kcal numeric(8, 2) not null default 0,
  protein_g numeric(7, 2) not null default 0,
  carbs_g numeric(7, 2) not null default 0,
  fat_g numeric(7, 2) not null default 0,
  fiber_g numeric(7, 2),
  sugar_g numeric(7, 2),
  sat_fat_g numeric(7, 2),
  sodium_mg numeric(9, 2),
  position smallint not null default 0
);
create index saved_meal_items_meal on public.saved_meal_items (saved_meal_id);

-- ---------------------------------------------------------------------------
-- Diary
-- ---------------------------------------------------------------------------
create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  meal smallint not null default 0 check (meal between 0 and 5),
  food_id uuid references public.foods (id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  brand text,
  grams numeric(8, 2) check (grams >= 0),
  serving_name text,
  quantity numeric(8, 3),
  -- nutrient snapshot (totals for this entry), so edits to a food never rewrite history
  kcal numeric(8, 2) not null default 0 check (kcal >= 0),
  protein_g numeric(7, 2) not null default 0,
  carbs_g numeric(7, 2) not null default 0,
  fat_g numeric(7, 2) not null default 0,
  fiber_g numeric(7, 2),
  sugar_g numeric(7, 2),
  sat_fat_g numeric(7, 2),
  sodium_mg numeric(9, 2),
  source text not null default 'manual' check (source in ('manual', 'quick', 'recipe', 'saved_meal', 'copy', 'import', 'ai')),
  external_id text,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index food_entries_user_date on public.food_entries (user_id, date);
create index food_entries_user_food on public.food_entries (user_id, food_id, logged_at desc);
create unique index food_entries_external on public.food_entries (user_id, source, external_id) where external_id is not null;
create trigger food_entries_updated before update on public.food_entries for each row execute function public.set_updated_at();

create table public.water_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  ml integer not null check (ml between 1 and 10000),
  source text not null default 'manual' check (source in ('manual', 'apple_health', 'import')),
  external_id text,
  logged_at timestamptz not null default now()
);
create index water_entries_user_date on public.water_entries (user_id, date);
create unique index water_entries_external on public.water_entries (user_id, source, external_id) where external_id is not null;

-- ---------------------------------------------------------------------------
-- Exercise
-- ---------------------------------------------------------------------------
create table public.exercise_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text not null check (category in ('cardio', 'strength', 'sports', 'flexibility', 'daily', 'other')),
  met numeric(4, 1) not null check (met between 1 and 25),
  is_strength boolean not null default false,
  muscle_group text,
  aliases text[] not null default '{}'
);
create unique index exercise_types_global_name on public.exercise_types (lower(name)) where user_id is null;
create unique index exercise_types_user_name on public.exercise_types (user_id, lower(name)) where user_id is not null;

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('cardio', 'strength')),
  exercise_type_id uuid references public.exercise_types (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  started_at timestamptz,
  ended_at timestamptz,
  duration_min numeric(6, 1) check (duration_min between 0 and 1440),
  intensity text check (intensity in ('light', 'moderate', 'vigorous')),
  distance_m numeric(9, 1) check (distance_m >= 0),
  kcal_estimate numeric(7, 1) check (kcal_estimate >= 0),
  kcal_override numeric(7, 1) check (kcal_override >= 0),
  avg_hr smallint,
  source text not null default 'manual' check (source in ('manual', 'apple_health', 'import')),
  external_id text,
  notes text,
  routine_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workouts_user_date on public.workouts (user_id, date);
create unique index workouts_external on public.workouts (user_id, source, external_id) where external_id is not null;
create trigger workouts_updated before update on public.workouts for each row execute function public.set_updated_at();

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_type_id uuid references public.exercise_types (id) on delete set null,
  exercise_name text not null,
  set_index smallint not null default 0,
  reps smallint check (reps between 0 and 1000),
  weight_kg numeric(6, 2) check (weight_kg between 0 and 1000),
  rpe numeric(3, 1) check (rpe between 1 and 10),
  is_warmup boolean not null default false,
  is_pr boolean not null default false,
  completed_at timestamptz not null default now()
);
create index workout_sets_workout on public.workout_sets (workout_id);
create index workout_sets_user_exercise on public.workout_sets (user_id, exercise_name, completed_at desc);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  kind text not null default 'strength' check (kind in ('cardio', 'strength')),
  -- [{exercise_name, exercise_type_id, sets, reps, weight_kg}] or cardio template
  items jsonb not null default '[]'::jsonb,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.workouts add constraint workouts_routine_fk foreign key (routine_id) references public.routines (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Body metrics & health samples
-- ---------------------------------------------------------------------------
create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  measured_at timestamptz not null default now(),
  weight_kg numeric(5, 2) check (weight_kg between 20 and 400),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 2 and 75),
  muscle_kg numeric(5, 2) check (muscle_kg between 5 and 200),
  lean_mass_kg numeric(5, 2) check (lean_mass_kg between 5 and 300),
  body_water_pct numeric(4, 1) check (body_water_pct between 20 and 80),
  bone_kg numeric(4, 2) check (bone_kg between 0.5 and 10),
  visceral_fat numeric(4, 1) check (visceral_fat between 0 and 60),
  bmi numeric(4, 1) check (bmi between 8 and 100),
  -- tape measurements in cm: {waist, hips, chest, arm_left, arm_right, thigh_left, thigh_right, neck, calf}
  measurements jsonb,
  source text not null default 'manual' check (source in ('manual', 'apple_health', 'renpho_csv', 'mfp_csv', 'import')),
  external_id text,
  note text,
  created_at timestamptz not null default now()
);
create index body_metrics_user_date on public.body_metrics (user_id, date);
create unique index body_metrics_dedupe on public.body_metrics (user_id, source, measured_at) where source <> 'manual';

create table public.health_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  metric text not null check (metric in (
    'steps', 'active_energy', 'resting_energy', 'resting_heart_rate', 'heart_rate',
    'sleep', 'distance', 'flights', 'exercise_minutes'
  )),
  start_at timestamptz not null,
  end_at timestamptz,
  date date not null,
  value numeric(12, 3) not null,
  unit text not null,
  source text not null default 'apple_health',
  external_id text,
  created_at timestamptz not null default now()
);
create unique index health_samples_dedupe on public.health_samples (user_id, source, metric, start_at);
create index health_samples_user_date on public.health_samples (user_id, date, metric);

-- ---------------------------------------------------------------------------
-- Summaries & TDEE
-- ---------------------------------------------------------------------------
create table public.daily_summaries (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  kcal numeric(8, 1) not null default 0,
  protein_g numeric(7, 1) not null default 0,
  carbs_g numeric(7, 1) not null default 0,
  fat_g numeric(7, 1) not null default 0,
  fiber_g numeric(7, 1) not null default 0,
  entry_count integer not null default 0,
  water_ml integer not null default 0,
  weight_kg numeric(5, 2),
  trend_weight_kg numeric(5, 2),
  -- user flags: "I logged everything" / "I fasted"
  is_complete boolean not null default false,
  is_fasted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table public.tdee_estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  formula_tdee integer not null,
  adaptive_tdee integer,
  blended_tdee integer not null,
  confidence text not null check (confidence in ('none', 'low', 'medium', 'high')),
  days_used smallint not null default 0,
  avg_intake integer,
  trend_change_kg_per_week numeric(5, 3),
  proposed_kcal integer,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
create index tdee_estimates_user_date on public.tdee_estimates (user_id, date desc);

-- ---------------------------------------------------------------------------
-- Integrations
-- ---------------------------------------------------------------------------
create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  token_hash text not null unique,
  prefix text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index api_tokens_user on public.api_tokens (user_id);

create table public.sync_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_id uuid references public.api_tokens (id) on delete set null,
  received_at timestamptz not null default now(),
  format text,
  status text not null check (status in ('ok', 'partial', 'error')),
  http_status smallint not null,
  counts jsonb,
  error text,
  raw jsonb,
  bytes integer
);
create index sync_log_user_time on public.sync_log (user_id, received_at desc);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  storage_path text not null,
  pose text not null default 'front' check (pose in ('front', 'side', 'back', 'other')),
  weight_kg numeric(5, 2),
  note text,
  created_at timestamptz not null default now()
);
create index progress_photos_user_date on public.progress_photos (user_id, date);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('log_meals', 'weigh_in', 'water', 'checkin', 'custom')),
  time_local time not null,
  days smallint[] not null default array[0, 1, 2, 3, 4, 5, 6]::smallint[],
  enabled boolean not null default true,
  message text,
  last_sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Server-only fixed-window rate limiter
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  c integer;
begin
  insert into public.rate_limits (key, window_start, count)
  values (p_key, w, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into c;
  -- opportunistic cleanup
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return c <= p_limit;
end;
$$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- New user → profile row
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Daily summary maintenance (cached totals)
-- ---------------------------------------------------------------------------
create or replace function public.refresh_daily_summary(p_user uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.daily_summaries as d (user_id, date, kcal, protein_g, carbs_g, fat_g, fiber_g, entry_count, water_ml, weight_kg, updated_at)
  select
    p_user,
    p_date,
    coalesce((select sum(kcal) from public.food_entries where user_id = p_user and date = p_date), 0),
    coalesce((select sum(protein_g) from public.food_entries where user_id = p_user and date = p_date), 0),
    coalesce((select sum(carbs_g) from public.food_entries where user_id = p_user and date = p_date), 0),
    coalesce((select sum(fat_g) from public.food_entries where user_id = p_user and date = p_date), 0),
    coalesce((select sum(fiber_g) from public.food_entries where user_id = p_user and date = p_date), 0),
    (select count(*) from public.food_entries where user_id = p_user and date = p_date),
    coalesce((select sum(ml) from public.water_entries where user_id = p_user and date = p_date), 0),
    (select weight_kg from public.body_metrics where user_id = p_user and date = p_date and weight_kg is not null order by measured_at asc limit 1),
    now()
  on conflict (user_id, date) do update set
    kcal = excluded.kcal,
    protein_g = excluded.protein_g,
    carbs_g = excluded.carbs_g,
    fat_g = excluded.fat_g,
    fiber_g = excluded.fiber_g,
    entry_count = excluded.entry_count,
    water_ml = excluded.water_ml,
    weight_kg = excluded.weight_kg,
    updated_at = now();
end;
$$;
revoke all on function public.refresh_daily_summary(uuid, date) from public, anon, authenticated;

create or replace function public.trg_refresh_daily_summary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_daily_summary(new.user_id, new.date);
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and (old.date <> new.date or old.user_id <> new.user_id)) then
    perform public.refresh_daily_summary(old.user_id, old.date);
  end if;
  return null;
end;
$$;

create trigger food_entries_summary after insert or update or delete on public.food_entries
  for each row execute function public.trg_refresh_daily_summary();
create trigger water_entries_summary after insert or update or delete on public.water_entries
  for each row execute function public.trg_refresh_daily_summary();
create trigger body_metrics_summary after insert or update or delete on public.body_metrics
  for each row execute function public.trg_refresh_daily_summary();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Standard owner-only tables
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'goals', 'food_favorites', 'recipes', 'recipe_items', 'saved_meals', 'saved_meal_items',
    'food_entries', 'water_entries', 'workouts', 'workout_sets', 'routines', 'body_metrics',
    'health_samples', 'daily_summaries', 'tdee_estimates', 'api_tokens', 'progress_photos',
    'push_subscriptions', 'reminders'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_select_own" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t, t);
    execute format('create policy "%s_insert_own" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t, t);
    execute format('create policy "%s_update_own" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t, t);
    execute format('create policy "%s_delete_own" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t, t);
  end loop;
end;
$$;

-- sync_log: read own rows only; written by the service role
alter table public.sync_log enable row level security;
create policy "sync_log_select_own" on public.sync_log for select to authenticated using (user_id = (select auth.uid()));

-- rate_limits: no client access at all
alter table public.rate_limits enable row level security;

-- foods: shared cache readable by any signed-in user; custom foods owner-only
alter table public.foods enable row level security;
create policy "foods_select" on public.foods for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy "foods_insert_own" on public.foods for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "foods_update_own" on public.foods for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "foods_delete_own" on public.foods for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.food_servings enable row level security;
create policy "food_servings_select" on public.food_servings for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy "food_servings_insert_own" on public.food_servings for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.foods f where f.id = food_id and f.user_id = (select auth.uid())));
create policy "food_servings_update_own" on public.food_servings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "food_servings_delete_own" on public.food_servings for delete to authenticated
  using (user_id = (select auth.uid()));

-- exercise_types: global list readable; users can add their own
alter table public.exercise_types enable row level security;
create policy "exercise_types_select" on public.exercise_types for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy "exercise_types_insert_own" on public.exercise_types for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "exercise_types_update_own" on public.exercise_types for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "exercise_types_delete_own" on public.exercise_types for delete to authenticated
  using (user_id = (select auth.uid()));

-- Anonymous role gets nothing
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Storage: private progress photos bucket, files under "<uid>/..."
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "progress_photos_read_own" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "progress_photos_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "progress_photos_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "progress_photos_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
