import { z } from "zod";
import { dbError, ok, parseBody, parseId, withAuth } from "@/lib/api/server";

const schema = z.object({ favorite: z.boolean() });

export const POST = withAuth<{ id: string }>(async (req, { supabase, userId }, params) => {
  const id = parseId(params);
  const { favorite } = await parseBody(req, schema);
  if (favorite) {
    const { error } = await supabase.from("food_favorites").upsert({ user_id: userId, food_id: id }, { onConflict: "user_id,food_id", ignoreDuplicates: true });
    dbError(error);
  } else {
    const { error } = await supabase.from("food_favorites").delete().eq("user_id", userId).eq("food_id", id);
    dbError(error);
  }
  return ok({ favorite });
});
