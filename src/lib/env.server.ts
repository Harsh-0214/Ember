import "server-only";

/** Server-only secrets. Never import this from client components. */
export const serverEnv = {
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  usdaApiKey: process.env.USDA_API_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
};

export const hasServiceRole = (): boolean => serverEnv.serviceRoleKey.length > 20;
export const hasAnthropic = (): boolean => serverEnv.anthropicApiKey.length > 10;
