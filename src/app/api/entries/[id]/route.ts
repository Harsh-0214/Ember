import { ApiError, dbError, ok, parseBody, parseId, withAuth } from "@/lib/api/server";
import { entryPatchSchema } from "@/lib/schemas/diary";

type P = { id: string };

export const PATCH = withAuth<P>(async (req, { supabase, userId }, params) => {
  const id = parseId(params);
  const patch = await parseBody(req, entryPatchSchema);
  const { data, error } = await supabase.from("food_entries").update(patch).eq("id", id).eq("user_id", userId).select("*").maybeSingle();
  dbError(error);
  if (!data) throw new ApiError(404, "not_found", "Entry not found");
  return ok({ entry: data });
});

export const DELETE = withAuth<P>(async (_req, { supabase, userId }, params) => {
  const id = parseId(params);
  const { error } = await supabase.from("food_entries").delete().eq("id", id).eq("user_id", userId);
  dbError(error);
  return ok({ ok: true });
});
