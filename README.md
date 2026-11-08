# Ember

Personal, all-in-one fitness and nutrition PWA: calorie and macro tracking, food search (USDA + Open Food Facts) with a local cache, barcode scanning, recipes, workouts, body metrics with trend weight, adaptive TDEE coaching, progress charts, and Apple Health ingest.

**Stack:** Next.js 16 (App Router), TypeScript (strict), Tailwind v4, shadcn-style UI, TanStack Query, Zod, Supabase (Auth, Postgres with RLS, Storage), Serwist (service worker), Dexie (offline outbox), Recharts, Vitest, Playwright.

- Plan, progress and decisions: [`PLAN.md`](PLAN.md)
- Deploying: [`docs/DEPLOY.md`](docs/DEPLOY.md)

## Local development (Windows, macOS or Linux)
```bash
npm install
cp .env.example .env.local   # fill in Supabase + USDA keys
npm run dev
```

## Database
Migrations live in `supabase/migrations`. Apply them to the hosted project with:
```bash
npx supabase link --project-ref <ref>
npx supabase db push
```
Alternatively, paste each file, in order, into the Supabase SQL editor.

- `npm run db:types` regenerates `src/types/database.ts` from the linked project.
- `npm run db:types:local` generates it from the migrations using an in-memory Postgres.
- `npm run db:check` applies all migrations to an in-memory Postgres and checks the triggers and RLS coverage.

## Checks
```bash
npm run typecheck && npm run lint && npm test
npm run e2e                        # against a real project (needs Supabase env vars)
bash scripts/e2e-mock.sh           # against a local mock Supabase (no keys needed)
```
