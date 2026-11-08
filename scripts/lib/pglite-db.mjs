// Boots an in-memory Postgres (PGlite) with minimal Supabase stubs
// (auth/storage schemas, roles) and applies every migration in order.
// Used for local validation only — never in the app.
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import fs from "node:fs";
import path from "node:path";

const STUBS = `
create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists cron;
create schema if not exists net;
create schema if not exists vault;
do $$ begin
  create role anon; create role authenticated; create role service_role;
exception when duplicate_object then null; end $$;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role', true) $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$ select 1::bigint $$;
create function cron.unschedule(job_name text) returns boolean language sql as $$ select true $$;
create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000) returns bigint language sql as $$ select 1::bigint $$;
create table vault.decrypted_secrets (name text, decrypted_secret text);
`;

export async function bootDb({ root = process.cwd(), log = false } = {}) {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(STUBS);
  const dir = path.join(root, "supabase", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), "utf8")
      // extensions managed by Supabase are stubbed above
      .replace(/create extension if not exists (pg_cron|pg_net)[^;]*;/gi, "");
    try {
      await db.exec(sql);
      if (log) console.log("✓", f);
    } catch (e) {
      throw new Error(`Migration ${f} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return db;
}
