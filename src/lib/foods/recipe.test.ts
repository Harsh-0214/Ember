import { describe, expect, it } from "vitest";
import { computeRecipe } from "./recipe";

const oats = { kcal: 379, protein_g: 13.2, carbs_g: 67.7, fat_g: 6.5, fiber_g: 10.1, sugar_g: 1, sat_fat_g: 1.1, sodium_mg: 6 };
const milk = { kcal: 50, protein_g: 3.3, carbs_g: 4.8, fat_g: 2, fiber_g: 0, sugar_g: 5, sat_fat_g: 1.3, sodium_mg: 47 };

describe("computeRecipe", () => {
  it("sums ingredients and divides into servings", () => {
    const r = computeRecipe([{ grams: 80, per100: oats }, { grams: 488, per100: milk }], 2);
    expect(r.rawGrams).toBe(568);
    expect(r.totals.kcal).toBeCloseTo(547.2, 1);
    expect(r.servingGrams).toBe(284);
    expect(r.perServing.kcal).toBeCloseTo(273.6, 0);
    expect(r.perServing.protein_g).toBeCloseTo(13.3, 0);
  });
  it("uses cooked weight for per-100 g values", () => {
    const r = computeRecipe([{ grams: 200, per100: oats }], 4, 800);
    expect(r.totalGrams).toBe(800);
    expect(r.per100.kcal).toBeCloseTo(94.8, 1);
    expect(r.servingGrams).toBe(200);
    expect(r.perServing.kcal).toBeCloseTo(189.6, 0);
  });
  it("handles empty recipes and zero servings", () => {
    const r = computeRecipe([], 0);
    expect(r.totals.kcal).toBe(0);
    expect(r.servingGrams).toBe(0);
  });
});
