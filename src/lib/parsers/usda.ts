import type { NormalizedFood } from "../schemas/food";
import { asArray, asRecord, asString, clampNum, r1, r2, tidyName, toNum } from "./numbers";

type Key = "kcal" | "kj" | "protein" | "carbs" | "fat" | "fiber" | "sugar" | "sat" | "sodium";

/** USDA nutrient numbers (legacy "number") and ids. */
const BY_NUMBER: Record<string, Key> = {
  "208": "kcal", "957": "kcal", "958": "kcal", "268": "kj",
  "203": "protein", "205": "carbs", "204": "fat", "291": "fiber",
  "269": "sugar", "539": "sugar", "606": "sat", "307": "sodium",
};
const BY_ID: Record<number, Key> = {
  1008: "kcal", 2047: "kcal", 2048: "kcal", 1062: "kj",
  1003: "protein", 1005: "carbs", 1004: "fat", 1079: "fiber",
  2000: "sugar", 1063: "sugar", 1258: "sat", 1093: "sodium",
};
/** Preference when several energy values exist (208 is the label value). */
const KCAL_PRIORITY = ["208", "958", "957"];

function collectNutrients(list: unknown[]): Partial<Record<Key, number>> {
  const out: Partial<Record<Key, number>> = {};
  const kcalCandidates: Record<string, number> = {};
  for (const item of list) {
    const it = asRecord(item);
    const nested = asRecord(it.nutrient);
    const number = asString(it.nutrientNumber) ?? asString(nested.number);
    const id = toNum(it.nutrientId) ?? toNum(nested.id);
    const unit = (asString(it.unitName) ?? asString(nested.unitName) ?? "").toLowerCase();
    const value = toNum(it.value) ?? toNum(it.amount);
    if (value == null) continue;
    const key = (number && BY_NUMBER[number]) ?? (id != null ? BY_ID[id] : undefined);
    if (!key) continue;
    if (key === "kcal") {
      if (unit === "kj") {
        out.kj ??= value;
        continue;
      }
      kcalCandidates[number ?? String(id)] = value;
      continue;
    }
    if (key === "sodium") {
      out.sodium = unit === "g" ? value * 1000 : value; // mg normally
      continue;
    }
    if (out[key] == null) out[key] = value;
  }
  for (const k of KCAL_PRIORITY) {
    if (kcalCandidates[k] != null) {
      out.kcal = kcalCandidates[k];
      break;
    }
  }
  if (out.kcal == null) {
    const any = Object.values(kcalCandidates)[0];
    if (any != null) out.kcal = any;
  }
  return out;
}

function servingsFrom(f: Record<string, unknown>): NormalizedFood["servings"] {
  const servings: NormalizedFood["servings"] = [];
  const unit = (asString(f.servingSizeUnit) ?? "").toLowerCase();
  const size = toNum(f.servingSize);
  if (size && size > 0 && size <= 5000 && ["g", "grm", "ml", "mlt"].includes(unit)) {
    const household = asString(f.householdServingFullText);
    servings.push({ name: (household ? `${household} (${r1(size)} ${unit.startsWith("m") ? "ml" : "g"})` : `1 serving (${r1(size)} ${unit.startsWith("m") ? "ml" : "g"})`).slice(0, 100), grams: r1(size) });
  }
  for (const p of asArray(f.foodPortions).concat(asArray(f.foodMeasures))) {
    const portion = asRecord(p);
    const grams = toNum(portion.gramWeight);
    if (!grams || grams <= 0 || grams > 5000) continue;
    const amount = toNum(portion.amount);
    const unitName = asString(asRecord(portion.measureUnit).name);
    const label =
      asString(portion.disseminationText) ??
      asString(portion.portionDescription) ??
      [amount != null && amount !== 1 ? amount : amount === 1 ? "1" : null, unitName && unitName !== "undetermined" ? unitName : null, asString(portion.modifier)]
        .filter(Boolean)
        .join(" ");
    if (!label || /quantity not specified/i.test(label)) continue;
    if (servings.some((s) => s.name === label)) continue;
    servings.push({ name: label.slice(0, 100), grams: r1(grams) });
    if (servings.length >= 8) break;
  }
  return servings;
}

/** Normalises a USDA FDC food (search hit or /food/{id} detail). Values are per 100 g. */
export function normalizeUsdaFood(raw: unknown): NormalizedFood | null {
  const f = asRecord(raw);
  const id = toNum(f.fdcId);
  const desc = asString(f.description);
  if (id == null || !desc) return null;
  const n = collectNutrients(asArray(f.foodNutrients));
  let kcal = n.kcal ?? (n.kj != null ? n.kj / 4.184 : null);
  if (kcal == null) {
    // derive from macros if needed (Foundation foods sometimes omit energy)
    if (n.protein != null || n.carbs != null || n.fat != null) kcal = (n.protein ?? 0) * 4 + (n.carbs ?? 0) * 4 + (n.fat ?? 0) * 9;
    else return null;
  }
  const brand = asString(f.brandName) ?? asString(f.brandOwner);
  const gtin = asString(f.gtinUpc)?.replace(/^0+(?=\d{12,})/, "") ?? null;
  const unit = (asString(f.servingSizeUnit) ?? "").toLowerCase();
  return {
    source: "usda",
    sourceId: String(id),
    name: tidyName(desc).slice(0, 200),
    brand: brand ? tidyName(brand).slice(0, 200) : null,
    barcode: gtin && /^\d{6,14}$/.test(gtin) ? gtin : null,
    basis: unit === "ml" || unit === "mlt" ? "ml" : "g",
    per100: {
      kcal: r1(clampNum(kcal, 0, 1000)!),
      protein_g: r2(clampNum(n.protein ?? 0, 0, 100)!),
      carbs_g: r2(clampNum(n.carbs ?? 0, 0, 100)!),
      fat_g: r2(clampNum(n.fat ?? 0, 0, 100)!),
      fiber_g: clampNum(n.fiber ?? null, 0, 100),
      sugar_g: clampNum(n.sugar ?? null, 0, 100),
      sat_fat_g: clampNum(n.sat ?? null, 0, 100),
      sodium_mg: n.sodium == null ? null : Math.round(clampNum(n.sodium, 0, 100000)!),
    },
    servings: servingsFrom(f),
  };
}

export function normalizeUsdaSearch(raw: unknown): NormalizedFood[] {
  const out: NormalizedFood[] = [];
  for (const f of asArray(asRecord(raw).foods)) {
    const n = normalizeUsdaFood(f);
    if (n) out.push(n);
  }
  return out;
}
