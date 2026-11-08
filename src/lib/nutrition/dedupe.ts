export interface WorkoutLike {
  id: string;
  source: string; // 'manual' | 'apple_health' | 'import'
  startedAt: string | null;
  endedAt: string | null;
  durationMin: number | null;
  kcalEstimate: number | null;
  kcalOverride: number | null;
}

export interface CountedWorkout<T extends WorkoutLike> {
  workout: T;
  /** Calories this workout contributes after de-duplication. */
  countedKcal: number;
  duplicateOf: string | null;
}

const windowOf = (w: WorkoutLike): [number, number] | null => {
  if (!w.startedAt) return null;
  const s = Date.parse(w.startedAt);
  if (Number.isNaN(s)) return null;
  let e = w.endedAt ? Date.parse(w.endedAt) : NaN;
  if (Number.isNaN(e) && w.durationMin != null) e = s + w.durationMin * 60_000;
  if (Number.isNaN(e) || e <= s) return null;
  return [s, e];
};

/** Fraction of the shorter workout that overlaps the other (0–1). */
export function overlapRatio(a: WorkoutLike, b: WorkoutLike): number {
  const wa = windowOf(a), wb = windowOf(b);
  if (!wa || !wb) return 0;
  const overlap = Math.min(wa[1], wb[1]) - Math.max(wa[0], wb[0]);
  if (overlap <= 0) return 0;
  return overlap / Math.min(wa[1] - wa[0], wb[1] - wb[0]);
}

export const workoutKcal = (w: WorkoutLike): number => Math.max(0, w.kcalOverride ?? w.kcalEstimate ?? 0);

/**
 * When an imported workout and a manual one cover the same time window
 * (≥50% overlap of the shorter one), count it once. The imported (measured)
 * value wins unless the manual entry has an explicit calorie override.
 */
export function dedupeWorkouts<T extends WorkoutLike>(workouts: T[], threshold = 0.5): CountedWorkout<T>[] {
  const result = workouts.map((w) => ({ workout: w, countedKcal: workoutKcal(w), duplicateOf: null as string | null }));
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const a = result[i]!, b = result[j]!;
      if (a.duplicateOf || b.duplicateOf) continue;
      if (a.workout.source === b.workout.source && a.workout.source === "manual") continue;
      if (overlapRatio(a.workout, b.workout) < threshold) continue;
      // decide which one is primary
      const aImported = a.workout.source !== "manual";
      const bImported = b.workout.source !== "manual";
      let primary = a, dup = b;
      if (aImported !== bImported) {
        const manual = aImported ? b : a;
        const imported = aImported ? a : b;
        if (manual.workout.kcalOverride != null) {
          primary = manual;
          dup = imported;
        } else {
          primary = imported;
          dup = manual;
        }
      } else if (workoutKcal(b.workout) > workoutKcal(a.workout)) {
        primary = b;
        dup = a;
      }
      dup.duplicateOf = primary.workout.id;
      dup.countedKcal = 0;
    }
  }
  return result;
}
