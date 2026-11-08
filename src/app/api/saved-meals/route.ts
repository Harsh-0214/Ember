import { dbError, ok, parseBody, withAuth } from "@/lib/api/server";
import { savedMealInputSchema } from "@/lib/schemas/recipes";

export const POST = withAuth(async (req, { supabase, userId }) => {
  const input = await parseBody(req, savedMealInputSchema);
  const { data: meal, error } = await supabase
    .from("saved_meals")
    .upsert({ ...(input.id ? { id: input.id } : {}), user_id: userId, name: input.name, default_meal: input.default_meal }, { onConflict: "id" })
    .select("*")
    .single();
  dbError(error);
  await supabase.from("saved_meal_items").delete().eq("saved_meal_id", meal!.id);
  const { data: items, error: iErr } = await supabase
    .from("saved_meal_items")
    .insert(input.items.map((it, i) => ({ ...it, user_id: userId, saved_meal_id: meal!.id, position: i })))
    .select("*");
  dbError(iErr);
  return ok({ meal: { ...meal, saved_meal_items: items ?? [] } }, 201);
});
