import { addDays, daysBetween, type LocalDate } from "../dates";

export const TREND_HALF_LIFE_DAYS = 10;

export interface WeightPoint {
  date: LocalDate;
  weightKg: number;
}

export interface TrendPoint {
  date: LocalDate;
  /** Raw weigh-in (daily mean if several), null on days without one. */
  weightKg: number | null;
  trendKg: number;
}

/**
 * Smoothing factor for a gap of `days` since the previous point.
 * α = 1 − 0.5^(Δ/halfLife), so a 10-day gap moves the trend halfway to the
 * new reading regardless of how many days were skipped in between.
 */
export const alphaFor = (days: number, halfLife = TREND_HALF_LIFE_DAYS): number => 1 - 0.5 ** (Math.max(days, 0) / halfLife);

/** Collapses multiple weigh-ins on a date into their mean and sorts ascending. */
export function dailyWeights(points: WeightPoint[]): WeightPoint[] {
  const by = new Map<LocalDate, { sum: number; n: number }>();
  for (const p of points) {
    if (!Number.isFinite(p.weightKg) || p.weightKg <= 0) continue;
    const e = by.get(p.date) ?? { sum: 0, n: 0 };
    e.sum += p.weightKg;
    e.n += 1;
    by.set(p.date, e);
  }
  return [...by.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, { sum, n }]) => ({ date, weightKg: sum / n }));
}

/**
 * Exponentially weighted moving average trend (~10-day half-life) at each
 * weigh-in. Time-aware: gaps between readings are accounted for.
 */
export function trendAtWeighIns(points: WeightPoint[], halfLife = TREND_HALF_LIFE_DAYS): TrendPoint[] {
  const daily = dailyWeights(points);
  const out: TrendPoint[] = [];
  let trend: number | null = null;
  let prev: LocalDate | null = null;
  for (const p of daily) {
    if (trend === null || prev === null) trend = p.weightKg;
    else trend = trend + alphaFor(daysBetween(prev, p.date), halfLife) * (p.weightKg - trend);
    prev = p.date;
    out.push({ date: p.date, weightKg: p.weightKg, trendKg: trend });
  }
  return out;
}

/**
 * One point per calendar day from the first weigh-in (or `start`) to `end`.
 * Days without a weigh-in carry the last trend value forward.
 */
export function dailyTrend(points: WeightPoint[], end: LocalDate, start?: LocalDate, halfLife = TREND_HALF_LIFE_DAYS): TrendPoint[] {
  const at = trendAtWeighIns(points, halfLife);
  if (at.length === 0) return [];
  const first = at[0]!.date;
  const from = start && start > first ? start : first;
  const out: TrendPoint[] = [];
  let i = 0;
  let last: TrendPoint | null = null;
  for (let d = first; d <= end; d = addDays(d, 1)) {
    let weightKg: number | null = null;
    if (i < at.length && at[i]!.date === d) {
      last = at[i]!;
      weightKg = last.weightKg;
      i++;
    }
    if (last && d >= from) out.push({ date: d, weightKg, trendKg: last.trendKg });
  }
  return out;
}

/** Latest trend weight on or before `date`. */
export function trendOn(points: WeightPoint[], date: LocalDate): number | null {
  const at = trendAtWeighIns(points.filter((p) => p.date <= date));
  return at.length ? at[at.length - 1]!.trendKg : null;
}

/** Ordinary least squares slope/intercept of y over x. */
export function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number; residualSd: number; n: number } {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, residualSd: 0, n };
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]!;
    sy += ys[i]!;
  }
  const mx = sx / n, my = sy / n;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i]! - mx) ** 2;
    sxy += (xs[i]! - mx) * (ys[i]! - my);
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (ys[i]! - (intercept + slope * xs[i]!)) ** 2;
  return { slope, intercept, residualSd: n > 2 ? Math.sqrt(ss / (n - 2)) : 0, n };
}
