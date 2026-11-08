import type { Nutrients } from "@/lib/nutrition";
import { G_PER_OZ, ML_PER_CUP, ML_PER_FL_OZ, type UnitSystem } from "@/lib/units";

export interface FoodLike {
  basis: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sat_fat_g: number | null;
  sodium_mg: number | null;
  food_servings?: { name: string; grams: number; is_default?: boolean; position?: number }[];
}

export const foodPer100 = (f: FoodLike): Nutrients => ({
  kcal: Number(f.kcal),
  protein_g: Number(f.protein_g),
  carbs_g: Number(f.carbs_g),
  fat_g: Number(f.fat_g),
  fiber_g: f.fiber_g == null ? null : Number(f.fiber_g),
  sugar_g: f.sugar_g == null ? null : Number(f.sugar_g),
  sat_fat_g: f.sat_fat_g == null ? null : Number(f.sat_fat_g),
  sodium_mg: f.sodium_mg == null ? null : Number(f.sodium_mg),
});

export interface UnitOption {
  id: string;
  label: string;
  /** grams (or ml) per 1 of this unit */
  grams: number;
  isServing: boolean;
}

/** Named servings first, then base units (g/ml, plus oz/fl oz/cup in imperial). */
export function unitOptions(f: FoodLike, units: UnitSystem): UnitOption[] {
  const servings = [...(f.food_servings ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((s, i) => ({ id: `s:${i}:${s.name}`, label: s.name, grams: Number(s.grams), isServing: true }));
  const base: UnitOption[] =
    f.basis === "ml"
      ? [
          { id: "ml", label: "ml", grams: 1, isServing: false },
          ...(units === "imperial"
            ? [
                { id: "floz", label: "fl oz", grams: ML_PER_FL_OZ, isServing: false },
                { id: "cup", label: "cup", grams: ML_PER_CUP, isServing: false },
              ]
            : []),
        ]
      : [{ id: "g", label: "g", grams: 1, isServing: false }, ...(units === "imperial" ? [{ id: "oz", label: "oz", grams: G_PER_OZ, isServing: false }] : [])];
  return [...servings, ...base];
}

export const findUnit = (opts: UnitOption[], servingName: string | null | undefined): UnitOption | undefined =>
  servingName ? opts.find((o) => o.label === servingName) ?? opts.find((o) => o.id === servingName) : undefined;

/** Default amount: last used, else default serving × 1, else 100 g/ml. */
export function defaultAmount(opts: UnitOption[], last?: { serving_name: string | null; quantity: number | null; grams: number | null } | null): { unit: UnitOption; qty: number } {
  if (last) {
    const u = findUnit(opts, last.serving_name);
    if (u && last.quantity != null && last.quantity > 0) return { unit: u, qty: Number(last.quantity) };
    if (last.grams != null && last.grams > 0) return { unit: opts.find((o) => !o.isServing)!, qty: Math.round(Number(last.grams)) };
  }
  const serving = opts.find((o) => o.isServing);
  if (serving) return { unit: serving, qty: 1 };
  return { unit: opts.find((o) => !o.isServing)!, qty: 100 };
}

const trimNum = (n: number) => (Math.round(n * 100) / 100).toString();

/** "1 large", "2 × 1 cup", "150 g". */
export function describeAmount(e: { serving_name: string | null; quantity: number | null; grams: number | null }, basis = "g"): string {
  if (e.serving_name && e.quantity != null && !["g", "ml"].includes(e.serving_name)) {
    const q = Number(e.quantity);
    if (["oz", "fl oz", "cup"].includes(e.serving_name)) return `${trimNum(q)} ${e.serving_name}${e.serving_name === "cup" && q !== 1 ? "s" : ""}`;
    return q === 1 ? e.serving_name : `${trimNum(q)} × ${e.serving_name}`;
  }
  if (e.grams != null) return `${trimNum(Number(e.grams))} ${e.serving_name === "ml" || basis === "ml" ? "ml" : "g"}`;
  return "";
}

/** Sensible stepper increment for a unit. */
export const stepFor = (u: UnitOption): number => (u.isServing || u.id === "cup" ? 0.5 : u.id === "oz" || u.id === "floz" ? 1 : 10);
