import type { EntryInput } from "@/lib/schemas/diary";
import type { NormalizedFood } from "@/lib/schemas/food";
import type { Nutrients } from "@/lib/nutrition";
import type { FoodLike } from "./amount";

/** Default meal slot from the local hour: breakfast, lunch, snacks, dinner. */
export function mealForHour(hour: number, mealCount = 4): number {
  const m = hour < 11 ? 0 : hour < 15 ? 1 : hour < 17 ? 3 : hour < 21 ? 2 : 3;
  return Math.min(m, mealCount - 1);
}

/** Adapts a normalised (online) food to the picker's FoodLike shape. */
export function normalizedToFoodLike(f: NormalizedFood): FoodLike & { name: string; brand: string | null } {
  return {
    name: f.name,
    brand: f.brand,
    basis: f.basis,
    ...f.per100,
    food_servings: f.servings.map((s, i) => ({ name: s.name, grams: s.grams, position: i, is_default: i === 0 })),
  };
}

export function buildEntry(p: {
  id: string;
  date: string;
  meal: number;
  foodId: string | null;
  name: string;
  brand: string | null;
  grams: number | null;
  quantity: number | null;
  servingName: string | null;
  nutrients: Nutrients;
  source?: EntryInput["source"];
}): EntryInput {
  return {
    id: p.id,
    date: p.date,
    meal: p.meal,
    food_id: p.foodId,
    name: p.name,
    brand: p.brand,
    grams: p.grams,
    quantity: p.quantity,
    serving_name: p.servingName,
    kcal: p.nutrients.kcal,
    protein_g: p.nutrients.protein_g,
    carbs_g: p.nutrients.carbs_g,
    fat_g: p.nutrients.fat_g,
    fiber_g: p.nutrients.fiber_g,
    sugar_g: p.nutrients.sugar_g,
    sat_fat_g: p.nutrients.sat_fat_g,
    sodium_mg: p.nutrients.sodium_mg,
    source: p.source ?? "manual",
    logged_at: new Date().toISOString(),
  };
}
