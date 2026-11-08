import { ApiError, dbError, ok, parseBody, parseId, withAuth } from "@/lib/api/server";
import { customFoodInputSchema } from "@/lib/schemas/food";

type P = { id: string };

/** Updates a custom food (RLS restricts this to the owner's rows). */
export const PATCH = withAuth<P>(async (req, { supabase, userId }, params) => {
  const id = parseId(params);
  const input = await parseBody(req, customFoodInputSchema);
  const { data: food, error } = await supabase
    .from("foods")
    .update({ name: input.name, brand: input.brand, barcode: input.barcode, basis: input.basis, ...input.per100 })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  dbError(error);
  if (!food) throw new ApiError(404, "not_found", "Food not found");
  await supabase.from("food_servings").delete().eq("food_id", id).eq("user_id", userId);
  let servings: unknown[] = [];
  if (input.servings.length) {
    const { data, error: sErr } = await supabase
      .from("food_servings")
      .insert(input.servings.map((s, i) => ({ food_id: id, user_id: userId, name: s.name, grams: s.grams, is_default: i === 0, position: i })))
      .select("*");
    dbError(sErr);
    servings = data ?? [];
  }
  return ok({ food: { ...food, food_servings: servings } });
});

export const DELETE = withAuth<P>(async (_req, { supabase, userId }, params) => {
  const id = parseId(params);
  const { error } = await supabase.from("foods").delete().eq("id", id).eq("user_id", userId);
  if (error?.code === "23503") throw new ApiError(409, "in_use", "This food is used in a recipe — remove it there first.");
  dbError(error);
  return ok({ ok: true });
});
