import { z } from "zod";
import { dbError, ok, parseBody, parseId, withAuth } from "@/lib/api/server";

type P = { id: string };
const patchSchema = z.object({ name: z.string().trim().min(1).max(200).optional(), last_used_at: z.iso.datetime({ offset: true }).optional() });

export const PATCH = withAuth<P>(async (req, { supabase, userId }, params) => {
  const id = parseId(params);
  const patch = await parseBody(req, patchSchema);
  const { data, error } = await supabase.from("saved_meals").update(patch).eq("id", id).eq("user_id", userId).select("*").single();
  dbError(error);
  return ok({ meal: data });
});

export const DELETE = withAuth<P>(async (_req, { supabase, userId }, params) => {
  const id = parseId(params);
  const { error } = await supabase.from("saved_meals").delete().eq("id", id).eq("user_id", userId);
  dbError(error);
  return ok({ ok: true });
});
