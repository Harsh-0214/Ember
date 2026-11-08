import { describe, expect, it } from "vitest";
import { defaultAmount, describeAmount, findUnit, foodPer100, stepFor, unitOptions } from "./amount";

const egg = { basis: "g", kcal: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.5, fiber_g: 0, sugar_g: null, sat_fat_g: 3.1, sodium_mg: 142, food_servings: [{ name: "2 large", grams: 100, position: 1 }, { name: "1 large", grams: 50, position: 0 }] };
const milk = { ...egg, basis: "ml", food_servings: [] };

describe("amount helpers", () => {
  it("lists servings first then base units", () => {
    expect(unitOptions(egg, "metric").map((u) => u.label)).toEqual(["1 large", "2 large", "g"]);
    expect(unitOptions(egg, "imperial").map((u) => u.label)).toEqual(["1 large", "2 large", "g", "oz"]);
    expect(unitOptions(milk, "imperial").map((u) => u.label)).toEqual(["ml", "fl oz", "cup"]);
  });
  it("defaults to the last used amount, then a serving, then 100 g", () => {
    const opts = unitOptions(egg, "metric");
    expect(defaultAmount(opts, { serving_name: "2 large", quantity: 1.5, grams: 150 })).toMatchObject({ qty: 1.5, unit: { label: "2 large" } });
    expect(defaultAmount(opts, { serving_name: null, quantity: null, grams: 75 })).toMatchObject({ qty: 75, unit: { label: "g" } });
    expect(defaultAmount(opts)).toMatchObject({ qty: 1, unit: { label: "1 large" } });
    expect(defaultAmount(unitOptions(milk, "metric"))).toMatchObject({ qty: 100, unit: { label: "ml" } });
    expect(findUnit(opts, "missing")).toBeUndefined();
  });
  it("describes amounts", () => {
    expect(describeAmount({ serving_name: "1 large", quantity: 1, grams: 50 })).toBe("1 large");
    expect(describeAmount({ serving_name: "1 large", quantity: 2, grams: 100 })).toBe("2 × 1 large");
    expect(describeAmount({ serving_name: "g", quantity: 150, grams: 150 })).toBe("150 g");
    expect(describeAmount({ serving_name: "cup", quantity: 2, grams: 473 })).toBe("2 cups");
    expect(describeAmount({ serving_name: null, quantity: null, grams: 250 }, "ml")).toBe("250 ml");
    expect(describeAmount({ serving_name: null, quantity: null, grams: null })).toBe("");
  });
  it("converts rows to per-100 nutrients and picks steps", () => {
    expect(foodPer100(egg).kcal).toBe(143);
    expect(foodPer100(egg).sugar_g).toBeNull();
    expect(stepFor({ id: "g", label: "g", grams: 1, isServing: false })).toBe(10);
    expect(stepFor({ id: "s", label: "1 large", grams: 50, isServing: true })).toBe(0.5);
  });
});
