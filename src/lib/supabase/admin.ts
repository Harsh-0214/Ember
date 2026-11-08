import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

let admin: SupabaseClient<Database> | null = null;

/**
 * Service-role client. Bypasses RLS — only use for:
 * shared food cache writes, token-authenticated Health ingest,
 * rate limiting and account deletion. Always scope queries by user_id.
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (!serverEnv.serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  if (!admin) {
    admin = createClient<Database>(publicEnv.supabaseUrl, serverEnv.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
