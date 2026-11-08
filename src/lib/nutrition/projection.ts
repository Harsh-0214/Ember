import { addDays, type LocalDate } from "../dates";

export interface Projection {
  status: "reached" | "on_track" | "wrong_direction" | "too_slow" | "no_data";
  date: LocalDate | null;
  weeks: number | null;
  message: string;
}

/**
 * Projects when the goal weight will be reached given the current trend
 * slope (kg/week). Falls back to the planned rate when there's no trend yet.
 */
export function projectGoal(p: {
  today: LocalDate;
  trendKg: number | null;
  goalKg: number | null;
  slopeKgPerWeek: number | null;
  plannedRateKgPerWeek?: number | null;
}): Projection {
  if (p.trendKg == null || p.goalKg == null) return { status: "no_data", date: null, weeks: null, message: "Log a few weigh-ins to see a projection." };
  const remaining = p.goalKg - p.trendKg;
  if (Math.abs(remaining) < 0.25) return { status: "reached", date: p.today, weeks: 0, message: "You're at your goal weight. 🎉" };
  const slope = p.slopeKgPerWeek ?? p.plannedRateKgPerWeek ?? null;
  if (slope == null) return { status: "no_data", date: null, weeks: null, message: "Log a few weigh-ins to see a projection." };
  if (Math.abs(slope) < 0.02) return { status: "too_slow", date: null, weeks: null, message: "Your weight is holding steady, so there's no projected date yet." };
  if (Math.sign(slope) !== Math.sign(remaining)) {
    return { status: "wrong_direction", date: null, weeks: null, message: "Your trend is moving away from your goal right now." };
  }
  const weeks = remaining / slope;
  if (weeks > 260) return { status: "too_slow", date: null, weeks, message: "At the current pace that's more than 5 years out." };
  return {
    status: "on_track",
    date: addDays(p.today, Math.round(weeks * 7)),
    weeks: Math.round(weeks * 10) / 10,
    message: `About ${Math.round(weeks)} weeks at your current pace.`,
  };
}
