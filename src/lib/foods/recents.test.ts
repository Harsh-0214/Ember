import { describe, expect, it } from "vitest";
import { aggregateRecents, byFrequent, byRecent, ilikePattern, matchScore, normalizeQuery } from "./recents";

const e = (food_id: string | null, name: string, logged_at: string, meal = 0, grams = 100) => ({ food_id, name, brand: null, grams, serving_name: null, quantity: null, meal, kcal: 100, logged_at });

describe("recent foods", () => {
  it("aggregates by food with counts, last entry and usual meals", () => {
    const r = aggregateRecents([
      e("a", "Oats", "2026-11-01T08:00:00Z", 0, 40),
      e("a", "Oats", "2026-11-03T08:00:00Z", 0, 50),
      e("b", "Chicken", "2026-11-02T12:00:00Z", 1),
      e("a", "Oats", "2026-11-02T20:00:00Z", 3),
      e(null, "Quick add", "2026-11-04T12:00:00Z", 1),
    ]);
    const oats = r.find((x) => x.foodId === "a")!;
    expect(oats.count).toBe(3);
    expect(oats.last.grams).toBe(50);
    expect(oats.meals).toEqual([0, 3]);
    expect(r.find((x) => x.foodId === null)!.key).toBe("name:quick add|");
    expect([...r].sort(byRecent)[0]!.name).toBe("Quick add");
    expect([...r].sort(byFrequent)[0]!.name).toBe("Oats");
  });
});

describe("search ranking", () => {
  it("prefers exact and prefix matches", () => {
    const egg = matchScore("egg", "Egg, whole, large");
    const eggplant = matchScore("egg", "Eggplant, raw");
    const noodles = matchScore("egg", "Noodles, egg, cooked");
    expect(egg).toBeGreaterThan(noodles);
    expect(eggplant).toBeGreaterThan(noodles);
    expect(matchScore("chicken breast", "Chicken breast, cooked")).toBeGreaterThan(matchScore("chicken breast", "Breaded chicken nuggets breast meat"));
    expect(matchScore("yogurt", "Granola")).toBe(0);
    expect(matchScore("oikos", "Greek yogurt", "Oikos")).toBeGreaterThan(0);
  });
  it("boosts personally frequent foods", () => {
    expect(matchScore("milk", "Milk, 2%", null, 10)).toBeGreaterThan(matchScore("milk", "Milk, 2%", null, 0));
  });
  it("normalises queries and builds safe ilike patterns", () => {
    expect(normalizeQuery("  Crème  Brûlée! ")).toBe("creme brulee");
    expect(ilikePattern("greek yo%gurt_")).toBe("%greek%yogurt%");
    expect(ilikePattern("a,b(c)")).toBe("%a%b%c%");
  });
});
