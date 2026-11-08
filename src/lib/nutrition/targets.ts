import { KCAL_PER_KG, type GoalType, type Sex } from "./types";

export const DEFAULT_FLOORS: Record<Sex, number> = { female: 1200, male: 1500 };

/** Default protein in g per kg of reference body weight. */
export const PROTEIN_G_PER_KG: Record<GoalType, number> = { lose: 2.0, maintain: 1.6, gain: 1.8 };
export const FAT_MIN_G_PER_KG = 0.6;
export const FAT_DEFAULT_PCT = 0.25;
export const FIBER_G_PER_1000_KCAL = 14;

export type RateLevel = "ok" | "aggressive" | "too_aggressive";

export interface RateAssessment {
  level: RateLevel;
  /** Recommended range in kg/week, signed (negative = loss). */
  recommendedMin: number;
  recommendedMax: number;
  message: string | null;
}

/**
 * Evaluates a target weekly rate. Recommended: lose 0.25–1.0 % of body weight
 * per week, gain 0.1–0.5 %/week. Above that it's flagged as aggressive, and
 * above 1.5 % (loss) / 1 % (gain) as too aggressive.
 */
export function assessRate(goal: GoalType, weeklyRateKg: number, weightKg: number): RateAssessment {
  const pct = (Math.abs(weeklyRateKg) / weightKg) * 100;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  if (goal === "maintain") return { level: "ok", recommendedMin: 0, recommendedMax: 0, message: null };
  if (goal === "lose") {
    const range = { recommendedMin: -r2(weightKg * 0.01), recommendedMax: -r2(weightKg * 0.0025) };
    if (pct > 1.5) return { level: "too_aggressive", ...range, message: "That pace risks muscle loss, fatigue and rebound. Most people do best at 0.5–1 % of body weight per week." };
    if (pct > 1.0) return { level: "aggressive", ...range, message: "This is fast. It's doable short-term, but expect more hunger and keep protein high." };
    return { level: "ok", ...range, message: null };
  }
  const range = { recommendedMin: r2(weightKg * 0.001), recommendedMax: r2(weightKg * 0.005) };
  if (pct > 1.0) return { level: "too_aggressive", ...range, message: "Gaining this fast adds mostly fat. Aim for 0.25–0.5 % of body weight per week." };
  if (pct > 0.5) return { level: "aggressive", ...range, message: "This is a fast bulk; expect a higher share of fat gain." };
  return { level: "ok", ...range, message: null };
}

export interface TargetInput {
  sex: Sex;
  weightKg: number;
  goalWeightKg?: number | null;
  tdeeKcal: number;
  goal: GoalType;
  /** Signed kg/week: negative to lose. Ignored for maintain. */
  weeklyRateKg: number;
  floorKcal?: number | null;
  proteinGPerKg?: number | null;
}

export interface Targets {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  /** Daily surplus (+) / deficit (−) actually applied. */
  dailyAdjustment: number;
  floorApplied: boolean;
  floorKcal: number;
  explanation: string;
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/**
 * Reference weight for protein: for weight loss with a much lower goal weight,
 * using full current weight overshoots protein for people with higher body fat,
 * so we use the midpoint between current and goal weight.
 */
export function proteinReferenceWeight(goal: GoalType, weightKg: number, goalWeightKg?: number | null): number {
  if (goal === "lose" && goalWeightKg != null && goalWeightKg < weightKg) return (weightKg + goalWeightKg) / 2;
  return weightKg;
}

export function computeTargets(input: TargetInput): Targets {
  const floorKcal = input.floorKcal ?? DEFAULT_FLOORS[input.sex];
  const rate = input.goal === "maintain" ? 0 : input.goal === "lose" ? -Math.abs(input.weeklyRateKg) : Math.abs(input.weeklyRateKg);
  const dailyAdjustmentRaw = (rate * KCAL_PER_KG) / 7;
  let kcal = input.tdeeKcal + dailyAdjustmentRaw;
  let floorApplied = false;
  if (kcal < floorKcal) {
    kcal = floorKcal;
    floorApplied = true;
  }
  kcal = roundTo(kcal, 10);

  const refWeight = proteinReferenceWeight(input.goal, input.weightKg, input.goalWeightKg);
  let protein = (input.proteinGPerKg ?? PROTEIN_G_PER_KG[input.goal]) * refWeight;
  const fatMin = FAT_MIN_G_PER_KG * input.weightKg;
  let fat = Math.max(fatMin, (kcal * FAT_DEFAULT_PCT) / 9);

  // Protein shouldn't exceed 40% of calories even on very low targets.
  protein = Math.min(protein, (kcal * 0.4) / 4);
  let carbs = (kcal - protein * 4 - fat * 9) / 4;
  if (carbs < 0) {
    // Trim fat back toward its minimum first, then carbs floor at 0.
    const deficitKcal = -carbs * 4;
    const fatRoom = (fat - fatMin) * 9;
    fat -= Math.min(fatRoom, deficitKcal) / 9;
    carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  }

  const adj = Math.round(kcal - input.tdeeKcal);
  const explanation =
    input.goal === "maintain"
      ? `Your estimated maintenance is about ${roundTo(input.tdeeKcal, 10)} kcal/day.`
      : floorApplied
        ? `Your pace would put you below the ${floorKcal} kcal safety floor, so we've capped it there.`
        : `About ${roundTo(input.tdeeKcal, 10)} kcal maintenance ${adj < 0 ? "minus" : "plus"} ${Math.abs(roundTo(adj, 10))} kcal/day to ${input.goal} ~${Math.abs(rate).toFixed(2)} kg/week.`;

  return {
    kcal,
    protein_g: Math.round(protein),
    carbs_g: Math.round(carbs),
    fat_g: Math.round(fat),
    fiber_g: Math.round((kcal / 1000) * FIBER_G_PER_1000_KCAL),
    dailyAdjustment: adj,
    floorApplied,
    floorKcal,
    explanation,
  };
}

/** Recompute carbs so macros add up to kcal after a user edits protein/fat. */
export function fillCarbs(kcal: number, protein_g: number, fat_g: number): number {
  return Math.max(0, Math.round((kcal - protein_g * 4 - fat_g * 9) / 4));
}

export const macroKcal = (m: { protein_g: number; carbs_g: number; fat_g: number }): number => m.protein_g * 4 + m.carbs_g * 4 + m.fat_g * 9;
