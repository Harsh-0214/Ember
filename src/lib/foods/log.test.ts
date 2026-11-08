import { describe, expect, it } from "vitest";
import { buildEntry, mealForHour, normalizedToFoodLike } from "./log";
import { entryInputSchema } from "../schemas/diary";

describe("logging helpers", () => {
  it("picks a meal by time of day", () => {
    expect(mealForHour(7)).toBe(0);
    expect(mealForHour(12)).toBe(1);
    expect(mealForHour(16)).toBe(3);
    expect(mealForHour(19)).toBe(2);
    expect(mealForHour(23)).toBe(3);
    expect(mealForHour(23, 3)).toBe(2);
  });
  it("builds a valid entry", () => {
    const e = buildEntry({
      id: "6f1c1e1e-1d2b-4c3a-9b8a-1a2b3c4d5e6f", date: "2026-11-08", meal: 1, foodId: null, name: "Apple", brand: null, grams: 182, quantity: 1, servingName: "1 medium",
      nutrients: { kcal: 95, protein_g: 0.5, carbs_g: 25, fat_g: 0.3, fiber_g: 4.4, sugar_g: 19, sat_fat_g: null, sodium_mg: 2 },
    });
    expect(entryInputSchema.safeParse(e).success).toBe(true);
  });
  it("adapts normalised foods", () => {
    const f = normalizedToFoodLike({ source: "off", sourceId: "1", name: "X", brand: null, barcode: null, basis: "ml", per100: { kcal: 40, protein_g: 0, carbs_g: 10, fat_g: 0, fiber_g: null, sugar_g: 10, sat_fat_g: null, sodium_mg: null }, servings: [{ name: "1 can", grams: 330 }] });
    expect(f.food_servings).toEqual([{ name: "1 can", grams: 330, position: 0, is_default: true }]);
    expect(f.kcal).toBe(40);
  });
});
