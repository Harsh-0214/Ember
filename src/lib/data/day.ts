"use client";
import { useMemo } from "react";
import { ageOn } from "@/lib/dates";
import { bmr, dailyBudget, dedupeWorkouts, netExerciseKcal, sumNutrients } from "@/lib/nutrition";
import { useDiary, useGoalFor, useProfile, useWeights, useWorkouts } from "./hooks";
import type { Profile, Workout } from "./types";

export function useLatestWeightKg(onOrBefore: string): number | null {
  const { data } = useWeights();
  return useMemo(() => {
    if (!data?.length) return null;
    const xs = data.filter((w) => w.date <= onOrBefore);
    return (xs.length ? xs[xs.length - 1]! : data[0]!).weightKg;
  }, [data, onOrBefore]);
}

export function bmrFor(profile: Profile | null | undefined, weightKg: number | null, date: string): number | null {
  if (!profile?.sex || !profile.height_cm || !profile.birth_date || !weightKg) return null;
  return bmr({ sex: profile.sex as "male" | "female", weightKg, heightCm: Number(profile.height_cm), ageYears: ageOn(profile.birth_date, date) }).kcal;
}

export function exerciseTotals(workouts: Workout[], bmrPerDay: number | null) {
  const counted = dedupeWorkouts(
    workouts.map((w) => ({
      ...w,
      startedAt: w.started_at,
      endedAt: w.ended_at,
      durationMin: w.duration_min == null ? null : Number(w.duration_min),
      kcalEstimate: w.kcal_estimate == null ? null : Number(w.kcal_estimate),
      kcalOverride: w.kcal_override == null ? null : Number(w.kcal_override),
    })),
  );
  const gross = counted.reduce((s, c) => s + c.countedKcal, 0);
  const net = counted.reduce((s, c) => s + (c.countedKcal > 0 ? netExerciseKcal(c.countedKcal, c.workout.durationMin, bmrPerDay ?? 1700) : 0), 0);
  return { counted, gross: Math.round(gross), net: Math.round(net) };
}

/** Everything the Today screen needs to compute totals vs targets. */
export function useDayTotals(date: string) {
  const profile = useProfile();
  const goal = useGoalFor(date);
  const diary = useDiary(date);
  const workouts = useWorkouts(date);
  const weightKg = useLatestWeightKg(date);
  return useMemo(() => {
    const totals = sumNutrients((diary.data ?? []).map((e) => ({ kcal: Number(e.kcal), protein_g: Number(e.protein_g), carbs_g: Number(e.carbs_g), fat_g: Number(e.fat_g), fiber_g: Number(e.fiber_g ?? 0), sugar_g: Number(e.sugar_g ?? 0), sat_fat_g: Number(e.sat_fat_g ?? 0), sodium_mg: Number(e.sodium_mg ?? 0) })));
    const b = bmrFor(profile.data, weightKg, date);
    const ex = exerciseTotals(workouts.data ?? [], b);
    const baseKcal = goal?.kcal_target ?? 2000;
    const budget = dailyBudget(baseKcal, ex.net, { enabled: profile.data?.exercise_budget_enabled ?? false, pct: profile.data?.exercise_budget_pct ?? 0 });
    return {
      loading: profile.isPending || diary.isPending,
      profile: profile.data ?? null,
      goal,
      entries: diary.data ?? [],
      workouts: workouts.data ?? [],
      totals,
      exercise: ex,
      budget,
      bmr: b,
      weightKg,
    };
  }, [profile.data, profile.isPending, goal, diary.data, diary.isPending, workouts.data, weightKg, date]);
}
