"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { publicEnv } from "@/lib/env";

export type TypedClient = SupabaseClient<Database>;

let client: TypedClient | null = null;

/** Browser Supabase client (anon key + user session cookies). RLS applies. */
export function getSupabaseBrowser(): TypedClient {
  if (!client) client = createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return client;
}
