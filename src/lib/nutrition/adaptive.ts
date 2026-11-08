import { addDays, daysBetween, type LocalDate } from "../dates";
import { dailyTrend, linearRegression, type WeightPoint } from "./trend";
import { KCAL_PER_KG, type Confidence } from "./types";

export interface IntakeDay {
  date: LocalDate;
  intakeKcal: number;
  /** Number of food entries logged that day. */
  entryCount: number;
  targetKcal: number;
  isComplete?: boolean;
  isFasted?: boolean;
}

export type DayStatus = "complete" | "fasted" | "incomplete" | "empty";

/**
 * A day counts towards the adaptive estimate when the user flagged it
 * complete/fasted, or when they logged at least 50% of their target.
 */
export function classifyDay(d: IntakeDay): DayStatus {
  if (d.isFasted) return "fasted";
  if (d.isComplete) return "complete";
  if (d.entryCount === 0 && d.intakeKcal <= 0) return "empty";
  return d.intakeKcal >= 0.5 * d.targetKcal ? "complete" : "incomplete";
}

export interface AdaptiveInput {
  /** Diary days (any order). Missing dates are treated as empty. */
  days: IntakeDay[];
  weights: WeightPoint[];
  formulaTdee: number;
  /** Last accepted/blended TDEE, used to clamp week-over-week change. */
  previousTdee?: number | null;
  /** Last day to include — normally yesterday (today is still in progress). */
  endDate: LocalDate;
  windowDays?: number;
  minDays?: number;
  maxWeeklyChange?: number;
}

export interface AdaptiveResult {
  formulaTdee: number;
  adaptiveTdee: number | null;
  blendedTdee: number;
  confidence: Confidence;
  daysUsed: number;
  daysExcluded: number;
  weighIns: number;
  avgIntake: number | null;
  trendChangeKgPerWeek: number | null;
  /** 0 = pure formula, 1 = pure adaptive. */
  blendWeight: number;
  clamped: boolean;
  reason: string;
}

export const ADAPTIVE_WINDOW_DAYS = 28;
export const ADAPTIVE_MIN_DAYS = 14;
export const MAX_WEEKLY_TDEE_CHANGE = 150;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Adaptive TDEE from intake and trend-weight change:
 *   TDEE ≈ mean daily intake − (trend slope kg/day × 7700 kcal/kg)
 * Uses the last 21–28 days, ignores incomplete days, blends gradually from
 * the formula estimate, and clamps week-to-week changes.
 */
export function estimateAdaptiveTdee(input: AdaptiveInput): AdaptiveResult {
  const windowDays = input.windowDays ?? ADAPTIVE_WINDOW_DAYS;
  const minDays = input.minDays ?? ADAPTIVE_MIN_DAYS;
  const maxChange = input.maxWeeklyChange ?? MAX_WEEKLY_TDEE_CHANGE;
  const start = addDays(input.endDate, -(windowDays - 1));
  const formula = Math.round(input.formulaTdee);

  const inWindow = input.days.filter((d) => d.date >= start && d.date <= input.endDate);
  const used = inWindow.filter((d) => {
    const s = classifyDay(d);
    return s === "complete" || s === "fasted";
  });
  const weighIns = input.weights.filter((w) => w.date >= start && w.date <= input.endDate);
  const weighInDays = new Set(weighIns.map((w) => w.date)).size;
  const daysExcluded = inWindow.length - used.length;

  const base = (reason: string, extra: Partial<AdaptiveResult> = {}): AdaptiveResult => {
    const prev = input.previousTdee;
    let blended = formula;
    let clamped = false;
    if (prev != null && Math.abs(blended - prev) > maxChange) {
      blended = Math.round(prev + Math.sign(blended - prev) * maxChange);
      clamped = true;
    }
    return {
      formulaTdee: formula,
      adaptiveTdee: null,
      blendedTdee: blended,
      confidence: "none",
      daysUsed: used.length,
      daysExcluded,
      weighIns: weighInDays,
      avgIntake: used.length ? Math.round(used.reduce((s, d) => s + d.intakeKcal, 0) / used.length) : null,
      trendChangeKgPerWeek: null,
      blendWeight: 0,
      clamped,
      reason,
      ...extra,
    };
  };

  if (used.length < minDays) {
    return base(`Need ${minDays} mostly complete days of logging in the last ${windowDays} (have ${used.length}).`);
  }
  if (weighInDays < 6) {
    return base(`Need at least 6 weigh-ins in the last ${windowDays} days (have ${weighInDays}).`);
  }

  // Trend weight per day across the window (warmed up with earlier weigh-ins).
  const trend = dailyTrend(input.weights.filter((w) => w.date <= input.endDate), input.endDate, start);
  if (trend.length < 14) {
    return base("Not enough weight history yet to measure a trend.");
  }
  const xs = trend.map((t) => daysBetween(start, t.date));
  const ys = trend.map((t) => t.trendKg);
  const reg = linearRegression(xs, ys);
  const avgIntake = used.reduce((s, d) => s + d.intakeKcal, 0) / used.length;
  const rawAdaptive = avgIntake - reg.slope * KCAL_PER_KG;
  // Sanity bounds: physiologically implausible results are clamped and treated as low confidence.
  const adaptive = clamp(rawAdaptive, Math.max(1000, formula * 0.6), formula * 1.6);
  const implausible = adaptive !== rawAdaptive;

  const completeness = used.length / windowDays;
  let confidence: Confidence;
  if (implausible) confidence = "low";
  else if (used.length >= 24 && weighInDays >= 16 && completeness >= 0.85) confidence = "high";
  else if (used.length >= 18 && weighInDays >= 9) confidence = "medium";
  else confidence = "low";

  const quality = { none: 0, low: 0.5, medium: 0.8, high: 1 }[confidence];
  const ramp = clamp((used.length - minDays) / (windowDays - minDays), 0, 1);
  // Even at the minimum day count give the data some say (25%).
  const blendWeight = clamp(0.25 + 0.75 * ramp, 0, 1) * quality;
  let blended = formula + blendWeight * (adaptive - formula);
  let clamped = false;
  const prev = input.previousTdee;
  if (prev != null && Math.abs(blended - prev) > maxChange) {
    blended = prev + Math.sign(blended - prev) * maxChange;
    clamped = true;
  }

  return {
    formulaTdee: formula,
    adaptiveTdee: Math.round(adaptive),
    blendedTdee: Math.round(blended),
    confidence,
    daysUsed: used.length,
    daysExcluded,
    weighIns: weighInDays,
    avgIntake: Math.round(avgIntake),
    trendChangeKgPerWeek: Math.round(reg.slope * 7 * 1000) / 1000,
    blendWeight: Math.round(blendWeight * 100) / 100,
    clamped,
    reason: implausible
      ? "Your logs and weight trend don't quite line up, so this estimate is held close to the formula."
      : `Based on ${used.length} logged days and ${weighInDays} weigh-ins.`,
  };
}
