import { dbError, ok, parseBody, withAuth } from "@/lib/api/server";
import { onboardingSchema } from "@/lib/schemas/profile";

/** Saves the onboarding wizard: profile, first goal and starting weight. */
export const POST = withAuth(async (req, { supabase, userId }) => {
  const { profile, goal, weight } = await parseBody(req, onboardingSchema);
  const { data: saved, error: pErr } = await supabase
    .from("profiles")
    .upsert({ user_id: userId, ...profile, onboarded_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select("*")
    .single();
  dbError(pErr);
  const { error: gErr } = await supabase.from("goals").upsert({ ...goal, user_id: userId }, { onConflict: "user_id,effective_from" });
  dbError(gErr);
  const { error: wErr } = await supabase
    .from("body_metrics")
    .upsert({ id: weight.id, user_id: userId, date: weight.date, weight_kg: weight.weight_kg, source: "manual", measured_at: new Date().toISOString() }, { onConflict: "id" });
  dbError(wErr);
  return ok({ profile: saved }, 201);
});
