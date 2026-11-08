import { dbError, ok, parseBody, parseId, withAuth } from "@/lib/api/server";
import { recipeInputSchema } from "@/lib/schemas/recipes";
import { saveRecipe } from "@/lib/foods/recipe-server";

type P = { id: string };

export const PATCH = withAuth<P>(async (req, { supabase, userId }, params) => {
  const id = parseId(params);
  const input = await parseBody(req, recipeInputSchema);
  return ok(await saveRecipe(supabase, userId, input, id));
});

/** Deletes the recipe; its linked food is removed via ON DELETE CASCADE. Diary history keeps its snapshots. */
export const DELETE = withAuth<P>(async (_req, { supabase, userId }, params) => {
  const id = parseId(params);
  const { error } = await supabase.from("recipes").delete().eq("id", id).eq("user_id", userId);
  dbError(error);
  return ok({ ok: true });
});
