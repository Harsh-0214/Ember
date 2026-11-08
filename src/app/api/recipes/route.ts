import { ok, parseBody, withAuth } from "@/lib/api/server";
import { recipeInputSchema } from "@/lib/schemas/recipes";
import { saveRecipe } from "@/lib/foods/recipe-server";

export const POST = withAuth(async (req, { supabase, userId }) => {
  const input = await parseBody(req, recipeInputSchema);
  return ok(await saveRecipe(supabase, userId, input), 201);
});
