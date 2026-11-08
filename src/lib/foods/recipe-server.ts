import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ApiError, dbError } from "@/lib/api/server";
import type { RecipeInput } from "@/lib/schemas/recipes";
import { foodPer100 } from "./amount";
import { computeRecipe } from "./recipe";

/** Creates or updates a recipe, its ingredients and its linked searchable food. */
export async function saveRecipe(supabase: SupabaseClient<Database>, userId: string, input: RecipeInput, recipeId?: string) {
  const ids = [...new Set(input.items.map((i) => i.food_id))];
  const { data: foods, error: fErr } = await supabase.from("foods").select("*").in("id", ids);
  dbError(fErr);
  const byId = new Map((foods ?? []).map((f) => [f.id, f]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) throw new ApiError(400, "validation", "Some ingredients no longer exist.");
  if (input.items.some((i) => byId.get(i.food_id)?.recipe_id && byId.get(i.food_id)?.recipe_id === recipeId)) throw new ApiError(400, "validation", "A recipe can't contain itself.");

  const calc = computeRecipe(input.items.map((i) => ({ grams: i.grams, per100: foodPer100(byId.get(i.food_id)!) })), input.servings, input.total_grams);
  const per100 = {
    kcal: Math.min(1000, calc.per100.kcal),
    protein_g: Math.min(100, calc.per100.protein_g),
    carbs_g: Math.min(100, calc.per100.carbs_g),
    fat_g: Math.min(100, calc.per100.fat_g),
    fiber_g: calc.per100.fiber_g,
    sugar_g: calc.per100.sugar_g,
    sat_fat_g: calc.per100.sat_fat_g,
    sodium_mg: calc.per100.sodium_mg,
  };

  const { data: recipe, error: rErr } = await supabase
    .from("recipes")
    .upsert({ ...(recipeId ? { id: recipeId } : input.id ? { id: input.id } : {}), user_id: userId, name: input.name, servings: input.servings, total_grams: input.total_grams, notes: input.notes }, { onConflict: "id" })
    .select("*")
    .single();
  dbError(rErr);
  if (!recipe) throw new ApiError(500, "db_error", "Couldn't save recipe");

  await supabase.from("recipe_items").delete().eq("recipe_id", recipe.id);
  const { error: iErr } = await supabase.from("recipe_items").insert(input.items.map((i, idx) => ({ user_id: userId, recipe_id: recipe.id, food_id: i.food_id, grams: i.grams, serving_name: i.serving_name, quantity: i.quantity, position: idx })));
  dbError(iErr);

  let foodId = recipe.food_id;
  if (foodId) {
    const { error } = await supabase.from("foods").update({ name: input.name, ...per100 }).eq("id", foodId).eq("user_id", userId);
    dbError(error);
  } else {
    const { data: food, error } = await supabase.from("foods").insert({ user_id: userId, source: "recipe", source_id: null, name: input.name, basis: "g", recipe_id: recipe.id, ...per100 }).select("id").single();
    dbError(error);
    foodId = food!.id;
    const { error: lErr } = await supabase.from("recipes").update({ food_id: foodId }).eq("id", recipe.id);
    dbError(lErr);
  }
  await supabase.from("food_servings").delete().eq("food_id", foodId).eq("user_id", userId);
  const servings = [
    { name: "1 serving", grams: calc.servingGrams },
    ...(input.servings !== 1 ? [{ name: "whole recipe", grams: Math.round(calc.totalGrams * 10) / 10 }] : []),
  ].filter((s) => s.grams > 0);
  if (servings.length) {
    const { error } = await supabase.from("food_servings").insert(servings.map((s, i) => ({ food_id: foodId!, user_id: userId, name: s.name, grams: s.grams, is_default: i === 0, position: i })));
    dbError(error);
  }
  return { recipe: { ...recipe, food_id: foodId }, totals: calc };
}
