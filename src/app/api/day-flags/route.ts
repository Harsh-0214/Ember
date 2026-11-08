import { dbError, ok, parseBody, withAuth } from "@/lib/api/server";
import { dayFlagsSchema } from "@/lib/schemas/diary";

/** Marks a day as completely logged or fasted (used by adaptive TDEE). */
export const POST = withAuth(async (req, { supabase, userId }) => {
  const { date, ...flags } = await parseBody(req, dayFlagsSchema);
  const { data, error } = await supabase.from("daily_summaries").upsert({ user_id: userId, date, ...flags }, { onConflict: "user_id,date" }).select("*").single();
  dbError(error);
  return ok({ summary: data });
});
