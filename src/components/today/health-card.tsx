"use client";
import Link from "next/link";
import { Activity, Footprints, HeartPulse, Moon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useHealth, useLastSync } from "@/lib/data/hooks";
import { formatSleep, summarizeHealth } from "@/lib/health/summary";
import { timeAgo } from "@/lib/dates";
import type { Workout } from "@/lib/data/types";

export function HealthCard({ date, workouts }: { date: string; workouts: Workout[] }) {
  const health = useHealth(date);
  const last = useLastSync();
  const s = summarizeHealth((health.data ?? []).map((x) => ({ ...x, value: Number(x.value) })));
  const hasAny = s.steps != null || s.activeKcal != null || s.restingHr != null || s.sleepMinutes != null || workouts.length > 0;
  const items = [
    { icon: Footprints, label: "Steps", value: s.steps != null ? s.steps.toLocaleString() : "—" },
    { icon: Activity, label: "Active", value: s.activeKcal != null ? `${s.activeKcal} kcal` : "—" },
    { icon: HeartPulse, label: "Resting HR", value: s.restingHr != null ? `${s.restingHr} bpm` : "—" },
    { icon: Moon, label: "Sleep", value: formatSleep(s.sleepMinutes) },
  ];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">Health</h2>
        <span className="text-xs text-muted-foreground">{last.data ? `Last synced ${timeAgo(last.data.received_at)}` : null}</span>
      </div>
      {hasAny ? (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            {items.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2.5">
                <Icon className="size-5 text-muted-foreground" aria-hidden />
                <div>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-[15px] font-semibold tabular">{value}</dd>
                </div>
              </div>
            ))}
          </dl>
          {workouts.length > 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {workouts.length} workout{workouts.length === 1 ? "" : "s"} ·{" "}
              {Math.round(workouts.reduce((a, w) => a + Number(w.kcal_override ?? w.kcal_estimate ?? 0), 0))} kcal
            </p>
          ) : null}
        </>
      ) : (
        <div className="mt-2 text-sm text-muted-foreground">
          <p>Steps, sleep, heart rate and workouts from your Apple Watch show up here.</p>
          <Link href="/settings/health" className="mt-2 inline-flex h-11 items-center font-semibold text-primary">Connect Apple Health →</Link>
        </div>
      )}
    </Card>
  );
}
