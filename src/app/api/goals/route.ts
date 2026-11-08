import { dbError, ok, parseBody, withAuth } from "@/lib/api/server";
import { goalInputSchema } from "@/lib/schemas/profile";

/** Saves targets effective from a date (one goal row per date). */
export const POST = withAuth(async (req, { supabase, userId }) => {
  const goal = await parseBody(req, goalInputSchema);
  const { data, error } = await supabase.from("goals").upsert({ ...goal, user_id: userId }, { onConflict: "user_id,effective_from" }).select("*").single();
  dbError(error);
  return ok({ goal: data });
});
