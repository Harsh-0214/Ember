"use client";
import Link from "next/link";
import { Pencil, Scale } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSaveBodyMetric } from "@/lib/data/hooks";
import type { BodyMetric } from "@/lib/data/types";
import { formatWeight, round, weightFromKg, weightToKg, weightUnit, type UnitSystem } from "@/lib/units";
import { uuid } from "@/lib/utils";

/** Weigh-in prompt when there's no weight for the day; otherwise shows weight + trend (tap to edit). */
export function WeighIn({ date, units, today, trendKg }: { date: string; units: UnitSystem; today: BodyMetric | null; trendKg: number | null }) {
  const save = useSaveBodyMetric();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState("");
  const weight = today?.weight_kg != null ? Number(today.weight_kg) : null;

  if (weight != null && !editing) {
    return (
      <Card className="flex items-center justify-between gap-2 p-2 pl-4">
        <button
          type="button"
          className="flex min-h-12 flex-1 items-center gap-2.5 text-left"
          onClick={() => {
            setV(String(round(weightFromKg(weight, units), 1)));
            setEditing(true);
          }}
          aria-label={`Weigh-in ${formatWeight(weight, units)}, tap to edit`}
        >
          <Scale className="size-5 text-muted-foreground" aria-hidden />
          <span>
            <span className="block text-xs text-muted-foreground">Weigh-in</span>
            <span className="flex items-center gap-1.5 text-[15px] font-semibold tabular">
              {formatWeight(weight, units)} <Pencil className="size-3.5 text-muted-foreground" aria-hidden />
            </span>
          </span>
        </button>
        {trendKg != null ? (
          <Link href="/progress" className="rounded-xl px-3 py-1.5 text-right hover:bg-muted">
            <span className="block text-xs text-muted-foreground">Trend</span>
            <span className="block text-[15px] font-semibold tabular">{formatWeight(trendKg, units)}</span>
          </Link>
        ) : null}
      </Card>
    );
  }

  const n = Number(v.replace(",", "."));
  const kg = Number.isFinite(n) && n > 0 ? weightToKg(n, units) : null;
  const valid = kg != null && kg >= 20 && kg <= 400;
  return (
    <Card className="p-4">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          save.mutate({ id: today?.id ?? uuid(), date, weight_kg: Math.round(kg! * 100) / 100, ...(today ? { measured_at: today.measured_at } : {}) });
          setV("");
          setEditing(false);
        }}
      >
        <label htmlFor="weigh" className="flex-1">
          <span className="mb-1.5 flex items-center gap-2 text-[15px] font-semibold">
            <Scale className="size-4 text-muted-foreground" aria-hidden /> {editing ? "Edit weigh-in" : "Weigh in today"}
          </span>
          <Input id="weigh" inputMode="decimal" placeholder={trendKg != null ? String(round(weightFromKg(trendKg, units), 1)) : weightUnit(units)} value={v} onChange={(e) => setV(e.target.value)} autoFocus={editing} />
        </label>
        {editing ? <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button> : null}
        <Button type="submit" disabled={!valid || save.isPending}>Save</Button>
      </form>
    </Card>
  );
}
