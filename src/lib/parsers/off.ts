import type { NormalizedFood } from "../schemas/food";
import { asArray, asRecord, asString, clampNum, r1, r2, tidyName, toNum } from "./numbers";

/** Fields requested from Open Food Facts (keeps responses small). */
export const OFF_FIELDS = [
  "code", "product_name", "product_name_en", "generic_name", "brands", "nutriments", "serving_size",
  "serving_quantity", "quantity", "product_quantity_unit", "nutrition_data_per",
].join(",");

/** Parses "30 g", "250ml", "1 cup (240 ml)" → grams/ml in the serving. */
export function parseServingSize(s: string | null): { grams: number; unit: "g" | "ml" } | null {
  if (!s) return null;
  const m = s.toLowerCase().replace(",", ".").match(/(\d+(?:\.\d+)?)\s*(g|gr|grams?|ml|millilit(?:er|re)s?|cl|l|oz|fl\.?\s?oz)\b/);
  if (!m) return null;
  const v = Number(m[1]);
  const u = m[2]!.replace(/\s/g, "");
  if (!Number.isFinite(v) || v <= 0) return null;
  if (u.startsWith("g")) return { grams: v, unit: "g" };
  if (u === "ml" || u.startsWith("millilit")) return { grams: v, unit: "ml" };
  if (u === "cl") return { grams: v * 10, unit: "ml" };
  if (u === "l") return { grams: v * 1000, unit: "ml" };
  if (u.startsWith("fl")) return { grams: r1(v * 29.5735), unit: "ml" };
  if (u === "oz") return { grams: r1(v * 28.3495), unit: "g" };
  return null;
}

/**
 * Normalises an Open Food Facts product (v2 API or search result) to Ember's
 * food model. Returns null when there's no usable name or energy value.
 */
export function normalizeOffProduct(raw: unknown): NormalizedFood | null {
  const p = asRecord(raw);
  const n = asRecord(p.nutriments);
  const code = asString(p.code);
  const name = asString(p.product_name_en) ?? asString(p.product_name) ?? asString(p.generic_name);
  if (!name) return null;

  let kcal = toNum(n["energy-kcal_100g"]);
  if (kcal == null) {
    const kj = toNum(n["energy-kj_100g"]) ?? toNum(n["energy_100g"]);
    if (kj != null) kcal = kj / 4.184;
  }
  if (kcal == null) return null;

  const sodiumG = toNum(n["sodium_100g"]);
  const saltG = toNum(n["salt_100g"]);
  const sodiumMg = sodiumG != null ? sodiumG * 1000 : saltG != null ? (saltG / 2.5) * 1000 : null;

  const quantityStr = asString(p.quantity)?.toLowerCase() ?? "";
  const perStr = asString(p.nutrition_data_per)?.toLowerCase() ?? "";
  const qUnit = asString(p.product_quantity_unit)?.toLowerCase();
  const basis: "g" | "ml" = perStr.includes("ml") || qUnit === "ml" || /\d\s*(ml|cl|l)\b/.test(quantityStr) ? "ml" : "g";

  const servings: NormalizedFood["servings"] = [];
  const servingStr = asString(p.serving_size);
  const servingQty = toNum(p.serving_quantity);
  const parsed = parseServingSize(servingStr);
  const grams = servingQty && servingQty > 0 ? servingQty : parsed?.grams;
  if (grams && grams > 0 && grams <= 5000) {
    servings.push({ name: (servingStr ?? `1 serving`).slice(0, 100), grams: r1(grams) });
  }
  const pkg = parseServingSize(quantityStr);
  if (pkg && pkg.grams > 0 && pkg.grams <= 5000 && !servings.some((s) => Math.abs(s.grams - pkg.grams) < 0.5)) {
    servings.push({ name: `whole package (${asString(p.quantity)})`.slice(0, 100), grams: r1(pkg.grams) });
  }

  const brand = asString(p.brands)?.split(",")[0]?.trim() ?? null;
  const barcode = code && /^\d{6,14}$/.test(code) ? code : null;

  return {
    source: "off",
    sourceId: code,
    name: tidyName(name).slice(0, 200),
    brand: brand ? brand.slice(0, 200) : null,
    barcode,
    basis,
    per100: {
      kcal: r1(clampNum(kcal, 0, 1000)!),
      protein_g: r2(clampNum(toNum(n["proteins_100g"]) ?? 0, 0, 100)!),
      carbs_g: r2(clampNum(toNum(n["carbohydrates_100g"]) ?? 0, 0, 100)!),
      fat_g: r2(clampNum(toNum(n["fat_100g"]) ?? 0, 0, 100)!),
      fiber_g: clampNum(toNum(n["fiber_100g"]), 0, 100),
      sugar_g: clampNum(toNum(n["sugars_100g"]), 0, 100),
      sat_fat_g: clampNum(toNum(n["saturated-fat_100g"]), 0, 100),
      sodium_mg: sodiumMg == null ? null : Math.round(clampNum(sodiumMg, 0, 100000)!),
    },
    servings,
  };
}

export function normalizeOffSearch(raw: unknown): NormalizedFood[] {
  const out: NormalizedFood[] = [];
  for (const p of asArray(asRecord(raw).products)) {
    const f = normalizeOffProduct(p);
    if (f) out.push(f);
  }
  return out;
}
