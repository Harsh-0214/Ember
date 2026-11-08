/**
 * Unit conversions. Everything is stored internally in metric
 * (kg, cm, g, ml, kcal); these helpers convert for display and input only.
 */
export type UnitSystem = "metric" | "imperial";

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
export const ML_PER_FL_OZ = 29.5735295625;
/** US customary cup (8 fl oz). */
export const ML_PER_CUP = 236.5882365;
export const G_PER_OZ = 28.349523125;
export const KCAL_PER_KJ = 1 / 4.184;

export const round = (n: number, decimals = 0): number => {
  const f = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * f) / f;
};

export const kgToLb = (kg: number): number => kg / KG_PER_LB;
export const lbToKg = (lb: number): number => lb * KG_PER_LB;
export const cmToIn = (cm: number): number => cm / CM_PER_IN;
export const inToCm = (inches: number): number => inches * CM_PER_IN;
export const mlToFlOz = (ml: number): number => ml / ML_PER_FL_OZ;
export const flOzToMl = (oz: number): number => oz * ML_PER_FL_OZ;
export const mlToCups = (ml: number): number => ml / ML_PER_CUP;
export const cupsToMl = (cups: number): number => cups * ML_PER_CUP;
export const gToOz = (g: number): number => g / G_PER_OZ;
export const ozToG = (oz: number): number => oz * G_PER_OZ;
export const kjToKcal = (kj: number): number => kj * KCAL_PER_KJ;
export const kcalToKj = (kcal: number): number => kcal / KCAL_PER_KJ;

export function cmToFtIn(cm: number): { ft: number; in: number } {
  const totalIn = cmToIn(cm);
  let ft = Math.floor(totalIn / 12);
  let inches = round(totalIn - ft * 12, 0);
  if (inches === 12) {
    ft += 1;
    inches = 0;
  }
  return { ft, in: inches };
}

export const ftInToCm = (ft: number, inches: number): number => inToCm(ft * 12 + inches);

/** Weight in the user's unit system (number only). */
export const weightFromKg = (kg: number, units: UnitSystem): number => (units === "imperial" ? kgToLb(kg) : kg);
export const weightToKg = (value: number, units: UnitSystem): number => (units === "imperial" ? lbToKg(value) : value);
export const weightUnit = (units: UnitSystem): "kg" | "lb" => (units === "imperial" ? "lb" : "kg");

export function formatWeight(kg: number | null | undefined, units: UnitSystem, decimals = 1): string {
  if (kg == null || !Number.isFinite(kg)) return "—";
  return `${round(weightFromKg(kg, units), decimals).toFixed(decimals)} ${weightUnit(units)}`;
}

/** Signed weight delta, e.g. "−0.4 kg". */
export function formatWeightDelta(kg: number, units: UnitSystem, decimals = 1): string {
  const v = round(weightFromKg(kg, units), decimals);
  const sign = v > 0 ? "+" : v < 0 ? "−" : "±";
  return `${sign}${Math.abs(v).toFixed(decimals)} ${weightUnit(units)}`;
}

export function formatHeight(cm: number | null | undefined, units: UnitSystem): string {
  if (cm == null || !Number.isFinite(cm)) return "—";
  if (units === "imperial") {
    const { ft, in: inches } = cmToFtIn(cm);
    return `${ft}′${inches}″`;
  }
  return `${round(cm)} cm`;
}

export function formatVolume(ml: number, units: UnitSystem): string {
  if (units === "imperial") {
    const cups = mlToCups(ml);
    return `${round(cups, 1)} ${round(cups, 1) === 1 ? "cup" : "cups"}`;
  }
  return ml >= 1000 ? `${round(ml / 1000, 2)} L` : `${round(ml)} ml`;
}

export function formatLength(cm: number | null | undefined, units: UnitSystem, decimals = 1): string {
  if (cm == null || !Number.isFinite(cm)) return "—";
  return units === "imperial" ? `${round(cmToIn(cm), decimals)} in` : `${round(cm, decimals)} cm`;
}

export const lengthFromCm = (cm: number, units: UnitSystem): number => (units === "imperial" ? cmToIn(cm) : cm);
export const lengthToCm = (v: number, units: UnitSystem): number => (units === "imperial" ? inToCm(v) : v);

export function formatDistance(m: number | null | undefined, units: UnitSystem): string {
  if (m == null || !Number.isFinite(m)) return "—";
  return units === "imperial" ? `${round(m / 1609.344, 2)} mi` : `${round(m / 1000, 2)} km`;
}

/** Water quick-add presets in ml: metric uses 250/500 ml, imperial uses 1 and 2 cups. */
export function waterPresets(units: UnitSystem): { label: string; ml: number }[] {
  return units === "imperial"
    ? [
        { label: "+1 cup", ml: round(ML_PER_CUP) },
        { label: "+2 cups", ml: round(ML_PER_CUP * 2) },
      ]
    : [
        { label: "+250 ml", ml: 250 },
        { label: "+500 ml", ml: 500 },
      ];
}

/**
 * Normalises an arbitrary weight unit string to kg.
 * Handles kg, g, lb/lbs, st (stone), oz.
 */
export function toKg(value: number, unit: string): number | null {
  const u = unit.trim().toLowerCase();
  if (["kg", "kgs", "kilogram", "kilograms"].includes(u)) return value;
  if (["g", "gram", "grams"].includes(u)) return value / 1000;
  if (["lb", "lbs", "pound", "pounds"].includes(u)) return lbToKg(value);
  if (["st", "stone"].includes(u)) return lbToKg(value * 14);
  if (["oz", "ounce", "ounces"].includes(u)) return ozToG(value) / 1000;
  return null;
}

/** Normalises an energy unit string to kcal (kcal, cal = kcal in Health exports, kJ). */
export function toKcal(value: number, unit: string): number | null {
  const u = unit.trim().toLowerCase();
  if (["kcal", "cal", "calories", "kilocalories", "kilocalorie", "kcals"].includes(u)) return value;
  if (["kj", "kilojoule", "kilojoules"].includes(u)) return kjToKcal(value);
  if (u === "j") return kjToKcal(value / 1000);
  return null;
}

/** Normalises a volume unit string to ml. */
export function toMl(value: number, unit: string): number | null {
  const u = unit.trim().toLowerCase().replace(/\s+/g, "");
  if (["ml", "millilitre", "milliliter", "milliliters", "millilitres"].includes(u)) return value;
  if (["l", "litre", "liter", "liters", "litres"].includes(u)) return value * 1000;
  if (["floz", "fl_oz_us", "fl_oz", "oz", "fluidounce", "floz_us"].includes(u)) return flOzToMl(value);
  if (["cup", "cups", "cup_us"].includes(u)) return cupsToMl(value);
  return null;
}

/** Normalises a distance unit string to metres. */
export function toMeters(value: number, unit: string): number | null {
  const u = unit.trim().toLowerCase();
  if (["m", "meter", "meters", "metre", "metres"].includes(u)) return value;
  if (["km", "kilometer", "kilometers", "kilometre", "kilometres"].includes(u)) return value * 1000;
  if (["mi", "mile", "miles"].includes(u)) return value * 1609.344;
  if (["yd", "yard", "yards"].includes(u)) return value * 0.9144;
  if (["ft", "foot", "feet"].includes(u)) return value * 0.3048;
  return null;
}
