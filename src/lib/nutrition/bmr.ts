import type { ActivityLevel, BmrMethod, Sex } from "./types";

/** Mifflin-St Jeor resting metabolic rate (kcal/day). */
export function mifflinStJeor(p: { sex: Sex; weightKg: number; heightCm: number; ageYears: number }): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.ageYears;
  return base + (p.sex === "male" ? 5 : -161);
}

/** Katch-McArdle (kcal/day), from lean body mass. */
export function katchMcArdle(p: { weightKg: number; bodyFatPct: number }): number {
  const lbm = p.weightKg * (1 - p.bodyFatPct / 100);
  return 370 + 21.6 * lbm;
}

export const ACTIVITY_LEVELS: Record<ActivityLevel, { multiplier: number; label: string; description: string }> = {
  sedentary: { multiplier: 1.2, label: "Mostly sitting", description: "Desk job, little walking, no regular exercise." },
  light: { multiplier: 1.375, label: "Lightly active", description: "On your feet some of the day or light exercise 1–3 days a week (~5–7k steps)." },
  moderate: { multiplier: 1.55, label: "Moderately active", description: "Exercise 3–5 days a week or an active job (~8–10k steps)." },
  active: { multiplier: 1.725, label: "Very active", description: "Hard exercise 6–7 days a week or a physical job (~12k+ steps)." },
  very_active: { multiplier: 1.9, label: "Athlete", description: "Training twice a day or heavy manual labour plus training." },
};

export const SEDENTARY_MULTIPLIER = ACTIVITY_LEVELS.sedentary.multiplier;

export interface BmrInput {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
  bodyFatPct?: number | null;
  method?: BmrMethod;
}

/**
 * BMR using the preferred method. Katch-McArdle is used only when requested
 * and a plausible body fat % is available (smart-scale BF% is approximate).
 */
export function bmr(p: BmrInput): { kcal: number; method: BmrMethod } {
  if (p.method === "katch" && p.bodyFatPct != null && p.bodyFatPct >= 3 && p.bodyFatPct <= 60) {
    return { kcal: katchMcArdle({ weightKg: p.weightKg, bodyFatPct: p.bodyFatPct }), method: "katch" };
  }
  return { kcal: mifflinStJeor(p), method: "mifflin" };
}

/**
 * Formula TDEE used as the basis for targets.
 * When exercise calories are added to the budget, the base must be
 * BMR × sedentary so activity is not counted twice.
 */
export function formulaTdee(p: BmrInput & { activity: ActivityLevel; exerciseBudgetEnabled?: boolean }): number {
  const { kcal } = bmr(p);
  const mult = p.exerciseBudgetEnabled ? SEDENTARY_MULTIPLIER : ACTIVITY_LEVELS[p.activity].multiplier;
  return kcal * mult;
}
