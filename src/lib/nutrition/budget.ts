export interface ExerciseBudgetSettings {
  enabled: boolean;
  /** 0–100 */
  pct: number;
}

export interface DailyBudget {
  baseKcal: number;
  exerciseCredit: number;
  budgetKcal: number;
}

/**
 * Default mode: fixed calorie target — exercise is shown but not added,
 * because the (adaptive) TDEE already includes your usual activity.
 * Opt-in mode: base is computed from BMR × sedentary, and a percentage of
 * *net* exercise calories (de-duplicated) is added on top.
 */
export function dailyBudget(baseKcal: number, netExerciseKcal: number, s: ExerciseBudgetSettings): DailyBudget {
  const pct = Math.min(100, Math.max(0, s.pct));
  const exerciseCredit = s.enabled ? Math.round((Math.max(0, netExerciseKcal) * pct) / 100) : 0;
  return { baseKcal, exerciseCredit, budgetKcal: baseKcal + exerciseCredit };
}
