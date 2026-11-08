import { dbError, ok, parseBody, withAuth } from "@/lib/api/server";
import { customFoodInputSchema } from "@/lib/schemas/food";

/** Creates a custom (user-owned) food with optional named servings. */
export const POST = withAuth(async (req, { supabase, userId }) => {
  const input = await parseBody(req, customFoodInputSchema);
  const { data: food, error } = await supabase
    .from("foods")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      user_id: userId,
      source: "custom",
      source_id: null,
      name: input.name,
      brand: input.brand,
      barcode: input.barcode,
      basis: input.basis,
      ...input.per100,
    })
    .select("*")
    .single();
  dbError(error);
  let servings: unknown[] = [];
  if (food && input.servings.length) {
    const { data, error: sErr } = await supabase
      .from("food_servings")
      .insert(input.servings.map((s, i) => ({ food_id: food.id, user_id: userId, name: s.name, grams: s.grams, is_default: i === 0, position: i })))
      .select("*");
    dbError(sErr);
    servings = data ?? [];
  }
  return ok({ food: { ...food, food_servings: servings } }, 201);
});
