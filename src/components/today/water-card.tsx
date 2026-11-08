"use client";
import { Droplet, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bar } from "@/components/ui/progress";
import { useAddWater, useDeleteWater, useWater } from "@/lib/data/hooks";
import { formatVolume, waterPresets, type UnitSystem } from "@/lib/units";
import { uuid } from "@/lib/utils";

export function WaterCard({ date, units, goalMl }: { date: string; units: UnitSystem; goalMl: number }) {
  const water = useWater(date);
  const add = useAddWater();
  const del = useDeleteWater();
  const total = (water.data ?? []).reduce((s, w) => s + w.ml, 0);
  const last = water.data?.[water.data.length - 1];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <Droplet className="size-4 text-water" aria-hidden /> Water
        </h2>
        <span className="text-sm text-muted-foreground tabular">
          {formatVolume(total, units)} / {formatVolume(goalMl, units)}
        </span>
      </div>
      <Bar className="mt-3" value={total} max={goalMl} colorClass="bg-water" label="Water intake" />
      <div className="mt-3 flex gap-2">
        {waterPresets(units).map((p) => (
          <Button key={p.label} variant="secondary" className="flex-1" onClick={() => add.mutate({ id: uuid(), date, ml: p.ml })}>
            {p.label}
          </Button>
        ))}
        <Button variant="ghost" size="icon" aria-label="Undo last water" disabled={!last} onClick={() => last && del.mutate(last)}>
          <Undo2 aria-hidden />
        </Button>
      </div>
    </Card>
  );
}
