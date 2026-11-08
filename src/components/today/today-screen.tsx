"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useSelectedDate } from "@/hooks/use-selected-date";
import { useSwipe } from "@/hooks/use-swipe";
import { useBodyDay, useDayFlags, useDeleteEntry, useSummary, useWater, useWeights } from "@/lib/data/hooks";
import { useDayTotals } from "@/lib/data/day";
import type { FoodEntry } from "@/lib/data/types";
import { addDays } from "@/lib/dates";
import { dailyInsight } from "@/lib/insights";
import { trendOn } from "@/lib/nutrition";
import type { UnitSystem } from "@/lib/units";
import { CalorieRing } from "./calorie-ring";
import { DateSwitcher } from "./date-switcher";
import { EditEntrySheet } from "./edit-entry-sheet";
import { HealthCard } from "./health-card";
import { MacroBars } from "./macro-bars";
import { MealSection } from "./meal-section";
import { WaterCard } from "./water-card";
import { WeighIn } from "./weigh-in";
import { CopyYesterday } from "./copy-yesterday";

export function TodayScreen() {
  const { date, today, setDate, shift } = useSelectedDate();
  const params = useSearchParams();
  const day = useDayTotals(date);
  const water = useWater(date);
  const body = useBodyDay(date);
  const weights = useWeights();
  const summary = useSummary(date);
  const flags = useDayFlags();
  const del = useDeleteEntry();
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const swipe = useSwipe(() => date < today && shift(1), () => shift(-1));

  const units: UnitSystem = day.profile?.units === "imperial" ? "imperial" : "metric";
  const mealNames = day.profile?.meal_names?.length ? day.profile.meal_names : ["Breakfast", "Lunch", "Dinner", "Snacks"];
  const todayMetric = (body.data ?? []).find((b) => b.weight_kg != null) ?? null;
  const todayWeight = todayMetric?.weight_kg ?? null;
  const trendKg = useMemo(() => (weights.data ? trendOn(weights.data, date) : null), [weights.data, date]);
  const weekAgoTrend = useMemo(() => (weights.data ? trendOn(weights.data, addDays(date, -7)) : null), [weights.data, date]);

  useEffect(() => {
    if (params.get("water") === "1") document.getElementById("water")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [params]);

  const tz = day.profile?.timezone ?? "America/Toronto";
  const isToday = date === today;
  const hour = isToday ? Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(new Date())) : 24;
  const g = day.goal;
  const targets = { protein: g?.protein_g ?? 120, carbs: g?.carbs_g ?? 200, fat: g?.fat_g ?? 65 };
  const waterMl = (water.data ?? []).reduce((s, w) => s + w.ml, 0);
  const insight = dailyInsight({
    hour, isToday, entryCount: day.entries.length, kcal: day.totals.kcal, budgetKcal: day.budget.budgetKcal,
    protein_g: day.totals.protein_g, proteinTarget: targets.protein, fiber_g: day.totals.fiber_g ?? 0, fiberTarget: g?.fiber_g ?? null,
    water_ml: waterMl, waterGoal_ml: day.profile?.water_goal_ml ?? 2500, weighedToday: todayWeight != null,
    weeklyTrendKg: trendKg != null && weekAgoTrend != null ? trendKg - weekAgoTrend : null, goal: (g?.goal_type as "lose" | "maintain" | "gain" | undefined) ?? undefined,
  });

  const byMeal = mealNames.map((_, i) => day.entries.filter((e) => e.meal === i));
  // entries whose meal index no longer exists go to the last meal
  const orphans = day.entries.filter((e) => e.meal >= mealNames.length);
  if (orphans.length) byMeal[mealNames.length - 1] = [...(byMeal[mealNames.length - 1] ?? []), ...orphans];

  return (
    <main className="px-4" {...swipe}>
      <DateSwitcher date={date} today={today} onChange={setDate} onShift={shift} />
      <h1 className="sr-only">Today</h1>

      {day.loading ? (
        <div className="grid gap-4 pt-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <div className="grid gap-4 pt-2">
          {params.get("welcome") === "1" && day.entries.length === 0 ? (
            <Card className="bg-accent p-4 text-accent-foreground ring-0">
              <p className="font-semibold">You&apos;re all set 🎉</p>
              <p className="mt-1 text-sm">Tap <strong>+</strong> next to a meal to log your first food. Search, pick, done.</p>
            </Card>
          ) : null}

          <Card className="p-5">
            <div className="flex flex-col items-center gap-4">
              <CalorieRing eaten={day.totals.kcal} budget={day.budget.budgetKcal} />
              <div className="grid w-full grid-cols-3 text-center text-sm">
                <div><p className="font-semibold tabular">{Math.round(day.budget.baseKcal).toLocaleString()}</p><p className="text-xs text-muted-foreground">Target</p></div>
                <div><p className="font-semibold tabular">{Math.round(day.totals.kcal).toLocaleString()}</p><p className="text-xs text-muted-foreground">Eaten</p></div>
                <div>
                  <p className="font-semibold tabular">{day.budget.exerciseCredit > 0 ? `+${day.budget.exerciseCredit}` : day.exercise.gross > 0 ? day.exercise.gross : "—"}</p>
                  <p className="text-xs text-muted-foreground">{day.budget.exerciseCredit > 0 ? "Exercise" : "Burned"}</p>
                </div>
              </div>
              <MacroBars protein={day.totals.protein_g} carbs={day.totals.carbs_g} fat={day.totals.fat_g} targets={targets} />
            </div>
            <p className="mt-4 border-t pt-3 text-[15px]">{insight}</p>
            <Link href="/help/targets" className="mt-1 inline-flex h-10 items-center gap-1.5 text-sm text-muted-foreground">
              <Info className="size-4" aria-hidden /> How your target works
            </Link>
          </Card>

          {day.entries.length === 0 ? <CopyYesterday date={date} /> : null}

          {isToday || todayWeight != null ? <WeighIn key={todayMetric?.id ?? "new"} date={date} units={units} today={todayMetric} trendKg={trendKg} /> : null}

          {mealNames.map((name, i) => (
            <MealSection key={`${name}-${i}`} name={name} index={i} date={date} today={today} mealNames={mealNames} entries={byMeal[i] ?? []} onEdit={setEditing} onDelete={(e) => del.removeWithUndo(e)} />
          ))}

          <div id="water">
            <WaterCard date={date} units={units} goalMl={day.profile?.water_goal_ml ?? 2500} />
          </div>

          <HealthCard date={date} workouts={day.workouts} />

          <Card className="grid gap-1 p-2">
            <label className="flex min-h-12 items-center justify-between gap-3 px-2">
              <span>
                <span className="block text-[15px] font-medium">Day fully logged</span>
                <span className="block text-xs text-muted-foreground">Helps Ember learn your true TDEE</span>
              </span>
              <Switch checked={summary.data?.is_complete ?? false} onCheckedChange={(v) => flags.mutate({ date, is_complete: v })} aria-label="Day fully logged" />
            </label>
            <label className="flex min-h-12 items-center justify-between gap-3 px-2">
              <span className="text-[15px] font-medium">Fasted / ate nothing</span>
              <Switch checked={summary.data?.is_fasted ?? false} onCheckedChange={(v) => flags.mutate({ date, is_fasted: v })} aria-label="Fasted" />
            </label>
          </Card>
          <p className="pb-2 text-center text-xs text-muted-foreground">Swipe left or right to change days</p>
        </div>
      )}
      <EditEntrySheet entry={editing} onClose={() => setEditing(null)} units={units} mealNames={mealNames} />
    </main>
  );
}
