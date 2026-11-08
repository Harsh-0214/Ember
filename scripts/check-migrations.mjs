// Applies all migrations to an in-memory Postgres and runs smoke checks.
import { bootDb } from "./lib/pglite-db.mjs";

const db = await bootDb({ log: true });
const uid = "00000000-0000-0000-0000-000000000001";
await db.exec(`insert into auth.users (id) values ('${uid}')`);
const profiles = await db.query("select count(*)::int as n from public.profiles");
if (profiles.rows[0].n !== 1) throw new Error("profile trigger failed");
await db.exec(`insert into public.food_entries (user_id, date, name, kcal, protein_g) values ('${uid}', '2026-11-08', 'Egg', 78, 6)`);
const s = await db.query("select kcal::float as kcal from public.daily_summaries");
if (s.rows[0].kcal !== 78) throw new Error("daily summary trigger failed");
const rls = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
if (rls.rows.length) throw new Error("Tables without RLS: " + rls.rows.map((r) => r.relname).join(", "));
const counts = await db.query("select (select count(*) from public.exercise_types)::int as ex, (select count(*) from public.foods)::int as foods");
console.log("seed:", counts.rows[0]);
console.log("All migration checks passed.");
