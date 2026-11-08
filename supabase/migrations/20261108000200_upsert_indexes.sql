-- PostgREST upserts (ON CONFLICT) can't target partial unique indexes.
-- Replace them with full unique indexes; NULLs remain distinct so rows without
-- an external id / source id never collide.

drop index if exists public.foods_shared_source;
create unique index foods_source_source_id on public.foods (source, source_id);

drop index if exists public.food_entries_external;
create unique index food_entries_external on public.food_entries (user_id, source, external_id);

drop index if exists public.water_entries_external;
create unique index water_entries_external on public.water_entries (user_id, source, external_id);

drop index if exists public.workouts_external;
create unique index workouts_external on public.workouts (user_id, source, external_id);

-- Body metrics: imported rows dedupe on (source, measured_at); manual rows have external_id = null
drop index if exists public.body_metrics_dedupe;
create unique index body_metrics_dedupe on public.body_metrics (user_id, source, external_id);
