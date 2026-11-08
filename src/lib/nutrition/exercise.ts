import type { Intensity } from "./types";

const INTENSITY_FACTOR: Record<Intensity, number> = { light: 0.85, moderate: 1, vigorous: 1.15 };

/** Gross calories: MET × body weight (kg) × hours, adjusted for intensity. */
export function metCalories(p: { met: number; weightKg: number; minutes: number; intensity?: Intensity | null }): number {
  const f = p.intensity ? INTENSITY_FACTOR[p.intensity] : 1;
  return Math.max(0, p.met * f * p.weightKg * (p.minutes / 60));
}

/**
 * Net calories above resting (MET − 1). This is what gets added to the
 * budget, because resting energy is already in BMR.
 */
export function netMetCalories(p: { met: number; weightKg: number; minutes: number; intensity?: Intensity | null }): number {
  const f = p.intensity ? INTENSITY_FACTOR[p.intensity] : 1;
  return Math.max(0, (p.met * f - 1) * p.weightKg * (p.minutes / 60));
}

/** Rough strength-session estimate from working sets (≈40 s work + rest each). */
export function strengthSessionMinutes(sets: number, restSeconds = 90): number {
  return Math.round((sets * (40 + restSeconds)) / 60);
}

/** Epley estimated 1RM. */
export const estimated1RM = (weightKg: number, reps: number): number => (reps <= 1 ? weightKg : weightKg * (1 + reps / 30));

export interface SetLike {
  exercise: string;
  weightKg: number | null;
  reps: number | null;
  isWarmup?: boolean;
}

export interface PrResult {
  isWeightPr: boolean;
  is1RmPr: boolean;
  isRepPr: boolean;
}

/** PR detection vs history of the same exercise (warm-ups ignored). */
export function detectPr(set: SetLike, history: SetLike[]): PrResult {
  const none = { isWeightPr: false, is1RmPr: false, isRepPr: false };
  if (set.isWarmup || set.weightKg == null || set.reps == null || set.reps <= 0) return none;
  const prev = history.filter((h) => !h.isWarmup && h.exercise.toLowerCase() === set.exercise.toLowerCase() && h.weightKg != null && h.reps != null && h.reps > 0);
  if (prev.length === 0) return none; // first time isn't a "PR"
  const maxW = Math.max(...prev.map((h) => h.weightKg!));
  const max1 = Math.max(...prev.map((h) => estimated1RM(h.weightKg!, h.reps!)));
  const repsAtW = prev.filter((h) => h.weightKg! >= set.weightKg!).map((h) => h.reps!);
  return {
    isWeightPr: set.weightKg > maxW,
    is1RmPr: estimated1RM(set.weightKg, set.reps) > max1 + 0.01,
    isRepPr: repsAtW.length > 0 && set.reps > Math.max(...repsAtW),
  };
}
