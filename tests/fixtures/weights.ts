import { addDays, type LocalDate } from "@/lib/dates";
import type { IntakeDay, WeightPoint } from "@/lib/nutrition";

/** Deterministic pseudo-random noise in [-1, 1]. */
export function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

export interface SimOptions {
  start: LocalDate;
  days: number;
  startWeightKg: number;
  trueTdee: number;
  intake: (i: number) => number;
  /** daily scale noise amplitude (kg) */
  noiseKg?: number;
  /** indices with water-weight spikes and their size */
  spikes?: Record<number, number>;
  /** indices with no weigh-in */
  skipWeigh?: Set<number>;
  /** indices with no logging */
  skipLog?: Set<number>;
  /** indices that are only partially logged (fraction of intake actually logged) */
  partial?: Record<number, number>;
  targetKcal?: number;
}

/** Simulates a person following energy balance with noisy scale readings. */
export function simulate(o: SimOptions): { days: IntakeDay[]; weights: WeightPoint[]; end: LocalDate } {
  const days: IntakeDay[] = [];
  const weights: WeightPoint[] = [];
  let mass = o.startWeightKg;
  for (let i = 0; i < o.days; i++) {
    const date = addDays(o.start, i);
    const eaten = o.intake(i);
    if (!o.skipWeigh?.has(i)) {
      const spike = o.spikes?.[i] ?? 0;
      weights.push({ date, weightKg: Math.round((mass + (o.noiseKg ?? 0.4) * noise(i + 1) + spike) * 10) / 10 });
    }
    if (!o.skipLog?.has(i)) {
      const logged = eaten * (o.partial?.[i] ?? 1);
      days.push({ date, intakeKcal: logged, entryCount: logged > 0 ? 4 : 0, targetKcal: o.targetKcal ?? eaten });
    }
    mass += (eaten - o.trueTdee) / 7700;
  }
  return { days, weights, end: addDays(o.start, o.days - 1) };
}
