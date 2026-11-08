import { dbError, ok, parseBody, withAuth } from "@/lib/api/server";
import { waterInputSchema } from "@/lib/schemas/diary";

export const POST = withAuth(async (req, { supabase, userId }) => {
  const w = await parseBody(req, waterInputSchema);
  const { data, error } = await supabase
    .from("water_entries")
    .upsert({ ...w, user_id: userId, source: "manual", logged_at: w.logged_at ?? new Date().toISOString() }, { onConflict: "id" })
    .select("*")
    .single();
  dbError(error);
  return ok({ water: data }, 201);
});
