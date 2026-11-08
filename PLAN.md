# Ember — Plan & Progress

Personal all-in-one fitness & nutrition PWA (food, water, exercise, body metrics, adaptive TDEE, progress, Apple Health ingest).
Single user, but secured for the public internet (Supabase Auth + RLS on every table).

## Architecture

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, `proxy.ts` instead of middleware), TypeScript strict, no `any` |
| UI | Tailwind v4, shadcn/ui-style primitives (owned in `src/components/ui`), lucide icons, Recharts (lazy) |
| Data | Supabase hosted (Postgres + Auth + Storage), `@supabase/ssr` |
| Client state | TanStack Query (cache, optimistic updates), Zod at every boundary |
| Offline | Serwist service worker (app shell + runtime caching), Dexie outbox for food/water/weight/workout mutations |
| Push | Web Push (VAPID). Scheduling via Supabase `pg_cron` → Edge Function `send-reminders` |
| Hosting | Vercel Hobby |
| Tests | Vitest (pure logic, fixtures), Playwright (onboarding, log food, log weight) |

**Request flow**
- *Reads*: client components use TanStack Query over the Supabase browser client. RLS restricts rows to `auth.uid()`. The shell renders instantly, works offline from the SW cache, and shows skeletons while data loads.
- *Mutations*: `fetch` to route handlers under `/api/*`. Each handler validates with Zod and writes through the server Supabase client bound to the user's cookie session, so RLS still applies. Route handlers (rather than server actions) were chosen so the offline outbox can replay requests verbatim. Every row created offline carries a client-generated UUID `id`, which makes replays idempotent (`upsert on id`).
- *Service role*: used only in `src/lib/supabase/admin.ts` (`server-only`), for the shared food cache, the Health ingest (token-authenticated, no cookie), account deletion, and the test-user setup.
- *External food APIs*: called only from `/api/foods/*`. Open Food Facts requests send the UA `Ember/1.0 (personal nutrition PWA)` and pass through an in-process token bucket (OFF asks for ≤10 search req/min and ≤100 product req/min). USDA FDC needs `USDA_API_KEY`. Every food viewed or logged is upserted into `foods` (`source`, `source_id`) so the next lookup is local.

**Pure domain code** (no I/O, heavily tested), in `src/lib`:
- `nutrition/`: BMR (Mifflin-St Jeor, Katch-McArdle), activity multipliers, targets, macro split, safety floors, trend weight (EWMA), adaptive TDEE, projection, MET calories, workout de-duplication, exercise-budget logic.
- `units/`: kg↔lb, cm↔ft/in, ml↔fl oz/cups, kJ↔kcal.
- `dates/`: IANA timezone → local date, day ranges, week boundaries.
- `parsers/`: Health Auto Export, Shortcut JSON, Renpho CSV, MyFitnessPal CSV, Open Food Facts and USDA normalisers.
- `insights/`: the one-line daily insight.

## Data model
All user tables have `user_id uuid not null default auth.uid()` and RLS `user_id = auth.uid()`. The exceptions are:
- `foods` and `food_servings`: shared cache rows have `user_id is null` and are readable by any authenticated user, but only the service role can write them. Custom foods are owned by their user.
- `exercise_types`: global rows are readable by all; users can add their own.

The tables are `profiles`, `goals`, `foods`, `food_servings`, `recipes`, `recipe_items`, `saved_meals`, `saved_meal_items`, `food_entries`, `water_entries`, `exercise_types`, `workouts`, `workout_sets`, `routines`, `body_metrics`, `health_samples`, `daily_summaries`, `tdee_estimates`, `api_tokens`, `sync_log`, `progress_photos`, `push_subscriptions`, `reminders`, and `rate_limits` (service-only).

- Units: internally kg, cm, g, ml, kcal. Nutrients are stored per 100 g or 100 ml (`basis`). Servings are stored as gram (or ml) weights.
- Dates: every entry has a `date` (the local date in `profiles.timezone`, default `America/Toronto`).
- Indexes on `(user_id, date)` everywhere.

## Phases
1. Setup, schema + RLS, auth, PWA shell + design system, `lib/nutrition` with tests
2. Onboarding, Today, food search/logging with cache, custom foods → Vercel deploy steps
3. Barcode scanner, recipes, saved meals, copy day/meal, water
4. Exercise (cardio + strength + routines), body metrics
5. Progress charts, adaptive TDEE, weekly check-in, goal projection, photos
6. Apple Health ingest API, tokens, setup guides, Health card, CSV imports
7. Offline outbox, push reminders, export, account deletion, polish + a11y
8. (Optional, needs `ANTHROPIC_API_KEY`) natural-language and photo food logging via Claude

## Progress
- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
- [ ] Phase 4
- [ ] Phase 5
- [ ] Phase 6
- [ ] Phase 7
- [ ] Phase 8

## Assumptions & decisions
- The cloud build environment can't see your local `.env.local`, so code is written against env vars with graceful fallbacks. Tests that need a live Supabase (e2e) skip themselves unless the keys are present.
- Mutations use route handlers rather than server actions, so the offline outbox can replay them.
- Rate limiting uses a Postgres fixed-window counter (`rate_limit_hit` RPC), because Vercel Hobby has no Redis.
- Trend weight is an EWMA with a 10-day half-life, using a time-aware α (`1 − 0.5^(Δdays/10)`) so that gaps are handled correctly.
- Safety floors default to 1,200 kcal (female) and 1,500 kcal (male).
