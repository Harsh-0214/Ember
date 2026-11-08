import { describe, expect, it } from "vitest";
import nutella from "../../../tests/fixtures/food/off-nutella.json";
import offSearch from "../../../tests/fixtures/food/off-search.json";
import usdaSearch from "../../../tests/fixtures/food/usda-search.json";
import usdaDetail from "../../../tests/fixtures/food/usda-detail-sr.json";
import { normalizeOffProduct, normalizeOffSearch, parseServingSize } from "./off";
import { normalizeUsdaFood, normalizeUsdaSearch } from "./usda";
import { tidyName, toNum } from "./numbers";
import { normalizedFoodSchema } from "../schemas/food";

describe("Open Food Facts", () => {
  it("normalises a product", () => {
    const f = normalizeOffProduct(nutella.product)!;
    expect(f).toMatchObject({ source: "off", sourceId: "3017624010701", barcode: "3017624010701", name: "Nutella hazelnut spread", brand: "Nutella", basis: "g" });
    expect(f.per100).toEqual({ kcal: 539, protein_g: 6.3, carbs_g: 57.5, fat_g: 30.9, fiber_g: 0, sugar_g: 56.3, sat_fat_g: 10.6, sodium_mg: 43 });
    expect(f.servings).toEqual([{ name: "15 g", grams: 15 }, { name: "whole package (400 g)", grams: 400 }]);
    expect(normalizedFoodSchema.safeParse(f).success).toBe(true);
  });
  it("handles kJ-only energy, ml basis, salt-only sodium and junk", () => {
    const list = normalizeOffSearch(offSearch);
    expect(list).toHaveLength(2);
    const coke = list[1]!;
    expect(coke.basis).toBe("ml");
    expect(coke.per100.kcal).toBe(43);
    expect(coke.per100.sodium_mg).toBe(0);
    expect(coke.servings[0]).toEqual({ name: "330 ml", grams: 330 });
    expect(list[0]!.servings[0]!.grams).toBe(175);
    expect(normalizeOffProduct(null)).toBeNull();
    expect(normalizeOffSearch({ nope: true })).toEqual([]);
  });
  it("parses serving sizes", () => {
    expect(parseServingSize("1 cup (240 ml)")).toEqual({ grams: 240, unit: "ml" });
    expect(parseServingSize("2 biscuits (25,5 g)")).toEqual({ grams: 25.5, unit: "g" });
    expect(parseServingSize("33 cl")).toEqual({ grams: 330, unit: "ml" });
    expect(parseServingSize("1.5 L")).toEqual({ grams: 1500, unit: "ml" });
    expect(parseServingSize("1 oz")).toEqual({ grams: 28.3, unit: "g" });
    expect(parseServingSize("one piece")).toBeNull();
  });
});

describe("USDA FoodData Central", () => {
  it("normalises search hits including Foundation energy variants", () => {
    const list = normalizeUsdaSearch(usdaSearch);
    expect(list).toHaveLength(2);
    const apple = list[0]!;
    expect(apple.name).toBe("Apple, Raw");
    expect(apple.per100.kcal).toBe(61.6); // Atwater specific preferred over general
    expect(apple.per100.fiber_g).toBe(2.1);
    expect(apple.servings).toEqual([{ name: "1 medium", grams: 182 }]);
    const clif = list[1]!;
    expect(clif.brand).toBe("Clif Bar");
    expect(clif.barcode).toBe("722252100900");
    expect(clif.per100.kcal).toBe(368);
    expect(clif.per100.sodium_mg).toBe(294);
    expect(clif.servings[0]).toEqual({ name: "1 BAR (68 g)", grams: 68 });
    for (const f of list) expect(normalizedFoodSchema.safeParse(f).success).toBe(true);
  });
  it("normalises SR Legacy details with portions", () => {
    const egg = normalizeUsdaFood(usdaDetail)!;
    expect(egg.per100.kcal).toBe(143);
    expect(egg.per100.protein_g).toBe(12.56);
    expect(egg.servings.map((s) => s.name)).toEqual(["1 large", "1 extra large", "1 cup (4.86 large eggs)"]);
  });
  it("rejects foods with no energy information", () => {
    expect(normalizeUsdaFood({ fdcId: 5, description: "x", foodNutrients: [] })).toBeNull();
    expect(normalizeUsdaFood({ description: "no id" })).toBeNull();
  });
});

describe("helpers", () => {
  it("coerces numbers", () => {
    expect(toNum("12,5 g")).toBe(12.5);
    expect(toNum("abc")).toBeNull();
    expect(toNum(Infinity)).toBeNull();
  });
  it("tidies shouty names", () => {
    expect(tidyName("CHEDDAR CHEESE, SHARP")).toBe("Cheddar Cheese, Sharp");
    expect(tidyName("Greek yogurt")).toBe("Greek yogurt");
  });
});
