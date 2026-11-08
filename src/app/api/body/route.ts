import { dbError, ok, parseBody, withAuth } from "@/lib/api/server";
import { bodyMetricInputSchema } from "@/lib/schemas/diary";

/** Creates or updates a body-metrics entry (weight, composition, tape measurements). */
export const POST = withAuth(async (req, { supabase, userId }) => {
  const b = await parseBody(req, bodyMetricInputSchema);
  const { data, error } = await supabase
    .from("body_metrics")
    .upsert({ ...b, user_id: userId, source: "manual", measured_at: b.measured_at ?? new Date().toISOString() }, { onConflict: "id" })
    .select("*")
    .single();
  dbError(error);
  return ok({ metric: data }, 201);
});
