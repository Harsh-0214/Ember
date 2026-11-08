/** One short, useful insight line for the Today screen. Pure and deterministic. */

export interface InsightInput {
  /** 0–24, local hour of the day being viewed (24 for past days). */
  hour: number;
  isToday: boolean;
  entryCount: number;
  kcal: number;
  budgetKcal: number;
  protein_g: number;
  proteinTarget: number;
  fiber_g: number;
  fiberTarget: number | null;
  water_ml: number;
  waterGoal_ml: number;
  weighedToday: boolean;
  /** Trend change over the last 7 days (kg), if known. */
  weeklyTrendKg?: number | null;
  goal?: "lose" | "maintain" | "gain";
}

interface ProteinOption {
  name: string;
  protein: number;
  kcal: number;
}

/** Protein-dense options for a typical serving. */
const PROTEIN_OPTIONS: ProteinOption[] = [
  { name: "Greek yogurt (¾ cup)", protein: 17, kcal: 100 },
  { name: "a chicken breast", protein: 53, kcal: 280 },
  { name: "a can of tuna", protein: 36, kcal: 165 },
  { name: "a protein shake", protein: 24, kcal: 120 },
  { name: "cottage cheese (½ cup)", protein: 12, kcal: 95 },
  { name: "2 eggs", protein: 13, kcal: 145 },
  { name: "half a block of tofu", protein: 30, kcal: 250 },
  { name: "shrimp (100 g)", protein: 24, kcal: 100 },
];

function proteinSuggestions(gap: number, kcalLeft: number): string[] {
  const fits = PROTEIN_OPTIONS.filter((o) => o.kcal <= Math.max(kcalLeft, 0) + 50);
  const pool = fits.length ? fits : PROTEIN_OPTIONS;
  // Prefer options that close the gap with the fewest calories per gram of protein.
  return [...pool]
    .sort((a, b) => Math.abs(Math.min(a.protein, gap) - gap) - Math.abs(Math.min(b.protein, gap) - gap) || a.kcal / a.protein - b.kcal / b.protein)
    .slice(0, 2)
    .map((o) => o.name);
}

export function dailyInsight(i: InsightInput): string {
  const remaining = Math.round(i.budgetKcal - i.kcal);
  const proteinGap = Math.round(i.proteinTarget - i.protein_g);

  if (i.isToday && i.entryCount === 0) {
    if (i.hour < 11) return "Fresh day. Logging breakfast first makes the rest of the day easy.";
    if (i.hour < 16) return "Nothing logged yet today. Add what you've eaten so far; rough is fine.";
    return "Nothing logged yet today. A quick estimate beats a blank day.";
  }
  if (!i.isToday && i.entryCount === 0) return "No food logged for this day. Mark it as fasted if that's right, so your TDEE stays accurate.";

  if (remaining < -150) {
    return `You're ${Math.abs(remaining)} kcal over today. One day barely moves your trend, so just pick up tomorrow.`;
  }

  const late = i.isToday ? i.hour >= 15 : true;
  if (proteinGap >= 20 && (late || proteinGap >= 60)) {
    const [a, b] = proteinSuggestions(proteinGap, remaining);
    return `You're ${proteinGap} g short on protein; ${a}${b ? ` or ${b}` : ""} would close the gap.`;
  }

  if (Math.abs(remaining) <= Math.max(50, i.budgetKcal * 0.04) && (late || !i.isToday)) {
    return proteinGap <= 10 ? "Calories and protein are right on target. 👌" : "Right on your calorie target.";
  }

  if (i.isToday && i.hour >= 18 && i.water_ml < i.waterGoal_ml * 0.5 && i.waterGoal_ml > 0) {
    return `Water is at ${Math.round(i.water_ml / 100) / 10} L. A couple of glasses this evening will help.`;
  }

  if (i.fiberTarget && i.fiber_g < i.fiberTarget * 0.5 && late) {
    return `Fibre is low today (${Math.round(i.fiber_g)} g). Berries, beans, oats or veg are easy wins.`;
  }

  if (i.isToday && !i.weighedToday && i.hour < 11) {
    return "Weigh in after waking (and after the bathroom) for the most consistent trend.";
  }

  if (i.weeklyTrendKg != null && i.goal && i.goal !== "maintain") {
    const good = i.goal === "lose" ? i.weeklyTrendKg < -0.05 : i.weeklyTrendKg > 0.05;
    if (good) return `Your trend moved ${Math.abs(Math.round(i.weeklyTrendKg * 10) / 10)} kg in the right direction this week. Keep it steady.`;
  }

  if (remaining > 0) return `${remaining} kcal left${proteinGap > 0 ? ` and ${proteinGap} g protein to go` : ""}.`;
  return "Logged and on track.";
}
