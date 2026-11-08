/**
 * Public env vars must be referenced literally so Next.js can inline them.
 * The app degrades to a setup screen when Supabase isn't configured.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
};

export const isSupabaseConfigured = (): boolean => publicEnv.supabaseUrl.startsWith("http") && publicEnv.supabaseAnonKey.length > 20;
