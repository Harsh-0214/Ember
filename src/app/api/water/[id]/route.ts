import { dbError, ok, parseId, withAuth } from "@/lib/api/server";

export const DELETE = withAuth<{ id: string }>(async (_req, { supabase, userId }, params) => {
  const id = parseId(params);
  const { error } = await supabase.from("water_entries").delete().eq("id", id).eq("user_id", userId);
  dbError(error);
  return ok({ ok: true });
});
