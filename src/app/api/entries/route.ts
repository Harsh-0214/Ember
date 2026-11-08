import { dbError, ok, parseBody, withAuth } from "@/lib/api/server";
import { entriesBatchSchema } from "@/lib/schemas/diary";

/** Creates (or idempotently re-creates) diary entries. */
export const POST = withAuth(async (req, { supabase, userId }) => {
  const { entries } = await parseBody(req, entriesBatchSchema);
  const rows = entries.map((e) => ({ ...e, user_id: userId, logged_at: e.logged_at ?? new Date().toISOString() }));
  const { data, error } = await supabase.from("food_entries").upsert(rows, { onConflict: "id" }).select("*");
  dbError(error);
  return ok({ entries: data ?? [] }, 201);
});
