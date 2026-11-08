import { per100FromTotals, scaleNutrients, sumNutrients, type Nutrients } from "@/lib/nutrition";

export interface RecipeItemInput {
  grams: number;
  per100: Nutrients;
}

export interface RecipeTotals {
  totalGrams: number;
  rawGrams: number;
  totals: Nutrients;
  perServing: Nutrients;
  per100: Nutrients;
  servingGrams: number;
}

/**
 * Recipe nutrition. Totals are the sum of ingredients; if a cooked weight is
 * given, per-100 g values are based on it (water loss concentrates nutrients).
 */
export function computeRecipe(items: RecipeItemInput[], servings: number, cookedGrams?: number | null): RecipeTotals {
  const rawGrams = items.reduce((s, i) => s + Math.max(0, i.grams), 0);
  const totals = sumNutrients(items.map((i) => scaleNutrients(i.per100, i.grams)));
  const totalGrams = cookedGrams && cookedGrams > 0 ? cookedGrams : rawGrams;
  const s = servings > 0 ? servings : 1;
  const servingGrams = Math.round((totalGrams / s) * 10) / 10;
  return {
    totalGrams,
    rawGrams,
    totals,
    perServing: scaleNutrients(per100FromTotals(totals, totalGrams), servingGrams),
    per100: per100FromTotals(totals, totalGrams),
    servingGrams,
  };
}
