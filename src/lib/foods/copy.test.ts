import { describe, expect, it } from "vitest";
import { copyEntries } from "./copy";
import { entryInputSchema } from "../schemas/diary";

describe("copyEntries", () => {
  it("copies with new ids, target date and optional meal", () => {
    let n = 0;
    const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
    const src = [
      { meal: 0, food_id: null, name: "Oats", brand: null, grams: 40, quantity: 1, serving_name: "1/2 cup dry", kcal: 152, protein_g: 5.3, carbs_g: 27, fat_g: 2.6, fiber_g: 4, sugar_g: null, sat_fat_g: null, sodium_mg: 2 },
      { meal: 2, food_id: null, name: "Rice", brand: null, grams: 158, quantity: 1, serving_name: "1 cup", kcal: 205, protein_g: 4.3, carbs_g: 44.6, fat_g: 0.4, fiber_g: null, sugar_g: null, sat_fat_g: null, sodium_mg: null },
    ];
    const out = copyEntries(src, "2026-11-09", () => ids[n++]!);
    expect(out.map((e) => [e.id, e.date, e.meal, e.source])).toEqual([
      [ids[0], "2026-11-09", 0, "copy"],
      [ids[1], "2026-11-09", 2, "copy"],
    ]);
    expect(copyEntries(src, "2026-11-09", () => ids[0]!, 3)[1]!.meal).toBe(3);
    for (const e of out) expect(entryInputSchema.safeParse(e).success).toBe(true);
  });
});
