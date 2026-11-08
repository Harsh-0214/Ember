import type { Nutrients } from "./types";

export const NUTRIENT_KEYS = ["kcal", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "sat_fat_g", "sodium_mg"] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

export const emptyNutrients = (): Nutrients => ({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, sat_fat_g: 0, sodium_mg: 0 });

const r = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
const scaleOpt = (v: number | null, f: number, d: number) => (v == null ? null : r(v * f, d));

/** Totals for `grams` of a food whose nutrients are given per 100 g/ml. */
export function scaleNutrients(per100: Nutrients, grams: number): Nutrients {
  const f = Math.max(0, grams) / 100;
  return {
    kcal: r(per100.kcal * f, 1),
    protein_g: r(per100.protein_g * f, 1),
    carbs_g: r(per100.carbs_g * f, 1),
    fat_g: r(per100.fat_g * f, 1),
    fiber_g: scaleOpt(per100.fiber_g, f, 1),
    sugar_g: scaleOpt(per100.sugar_g, f, 1),
    sat_fat_g: scaleOpt(per100.sat_fat_g, f, 1),
    sodium_mg: scaleOpt(per100.sodium_mg, f, 0),
  };
}

/** Per-100 g values from totals over a weight (used for recipes). */
export function per100FromTotals(totals: Nutrients, grams: number): Nutrients {
  if (grams <= 0) return emptyNutrients();
  return scaleNutrients(totals, (100 / grams) * 100);
}

export function sumNutrients(items: Partial<Nutrients>[]): Nutrients {
  const out = emptyNutrients();
  for (const it of items) {
    for (const k of NUTRIENT_KEYS) {
      const v = it[k];
      if (typeof v === "number" && Number.isFinite(v)) out[k] = (out[k] ?? 0) + v;
    }
  }
  for (const k of NUTRIENT_KEYS) out[k] = r(out[k] ?? 0, k === "sodium_mg" ? 0 : 1);
  return out;
}

/** Simple consistency check: Atwater calories vs stated kcal (±25% or ±40 kcal). */
export function macrosConsistent(n: Pick<Nutrients, "kcal" | "protein_g" | "carbs_g" | "fat_g">): boolean {
  const atwater = n.protein_g * 4 + n.carbs_g * 4 + n.fat_g * 9;
  return Math.abs(atwater - n.kcal) <= Math.max(40, n.kcal * 0.25);
}
