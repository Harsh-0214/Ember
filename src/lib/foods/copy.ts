import type { EntryInput } from "@/lib/schemas/diary";

export interface EntryLike {
  meal: number;
  food_id: string | null;
  name: string;
  brand: string | null;
  grams: number | null;
  quantity: number | null;
  serving_name: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sat_fat_g: number | null;
  sodium_mg: number | null;
}

/**
 * Copies entries to a date (optionally into a different meal), with fresh ids.
 * `makeId` is injected so this stays pure and testable.
 */
export function copyEntries(entries: EntryLike[], toDate: string, makeId: () => string, toMeal?: number, source: EntryInput["source"] = "copy"): EntryInput[] {
  const now = new Date().toISOString();
  return entries.map((e) => ({
    id: makeId(),
    date: toDate,
    meal: toMeal ?? e.meal,
    food_id: e.food_id,
    name: e.name,
    brand: e.brand,
    grams: e.grams == null ? null : Number(e.grams),
    quantity: e.quantity == null ? null : Number(e.quantity),
    serving_name: e.serving_name,
    kcal: Number(e.kcal),
    protein_g: Number(e.protein_g),
    carbs_g: Number(e.carbs_g),
    fat_g: Number(e.fat_g),
    fiber_g: e.fiber_g == null ? null : Number(e.fiber_g),
    sugar_g: e.sugar_g == null ? null : Number(e.sugar_g),
    sat_fat_g: e.sat_fat_g == null ? null : Number(e.sat_fat_g),
    sodium_mg: e.sodium_mg == null ? null : Number(e.sodium_mg),
    source,
    logged_at: now,
  }));
}
