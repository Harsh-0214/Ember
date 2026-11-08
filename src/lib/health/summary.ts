export interface SampleLike {
  metric: string;
  value: number;
  start_at: string;
  end_at: string | null;
  source?: string;
}

export interface HealthSummary {
  steps: number | null;
  activeKcal: number | null;
  restingKcal: number | null;
  restingHr: number | null;
  avgHr: number | null;
  sleepMinutes: number | null;
  distanceM: number | null;
}

/**
 * Daily health totals. Cumulative metrics (steps, energy, distance) are summed;
 * resting heart rate uses the latest reading; sleep is summed in minutes
 * (samples are assigned to the local date they end on, i.e. the wake-up day).
 */
export function summarizeHealth(samples: SampleLike[]): HealthSummary {
  const by = (m: string) => samples.filter((s) => s.metric === m);
  const sum = (m: string) => {
    const xs = by(m);
    return xs.length ? xs.reduce((a, s) => a + Number(s.value), 0) : null;
  };
  const latest = (m: string) => {
    const xs = by(m).sort((a, b) => (a.start_at < b.start_at ? 1 : -1));
    return xs.length ? Number(xs[0]!.value) : null;
  };
  const avg = (m: string) => {
    const xs = by(m);
    return xs.length ? xs.reduce((a, s) => a + Number(s.value), 0) / xs.length : null;
  };
  const round = (n: number | null) => (n == null ? null : Math.round(n));
  return {
    steps: round(sum("steps")),
    activeKcal: round(sum("active_energy")),
    restingKcal: round(sum("resting_energy")),
    restingHr: round(latest("resting_heart_rate")),
    avgHr: round(avg("heart_rate")),
    sleepMinutes: round(sum("sleep")),
    distanceM: round(sum("distance")),
  };
}

export const formatSleep = (min: number | null): string => (min == null ? "—" : `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`);
