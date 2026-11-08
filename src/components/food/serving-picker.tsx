"use client";
import { Heart, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { defaultAmount, foodPer100, stepFor, unitOptions, type FoodLike, type UnitOption } from "@/lib/foods/amount";
import { scaleNutrients, type Nutrients } from "@/lib/nutrition";
import type { UnitSystem } from "@/lib/units";
import { cn } from "@/lib/utils";

export interface PickedAmount {
  grams: number;
  quantity: number;
  servingName: string;
  meal: number;
  nutrients: Nutrients;
}

export function ServingPicker({
  food,
  units,
  mealNames,
  initialMeal,
  initial,
  confirmLabel = "Add",
  onConfirm,
  favorite,
  onToggleFavorite,
  busy,
  secondaryAction,
}: {
  food: FoodLike & { name: string; brand?: string | null };
  units: UnitSystem;
  mealNames: string[];
  initialMeal: number;
  initial?: { serving_name: string | null; quantity: number | null; grams: number | null } | null;
  confirmLabel?: string;
  onConfirm: (a: PickedAmount) => void;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  busy?: boolean;
  secondaryAction?: React.ReactNode;
}) {
  const opts = useMemo(() => unitOptions(food, units), [food, units]);
  const def = useMemo(() => defaultAmount(opts, initial), [opts, initial]);
  const [unit, setUnit] = useState<UnitOption>(def.unit);
  const [qtyStr, setQtyStr] = useState(String(def.qty));
  const [meal, setMeal] = useState(initialMeal);
  const qty = Math.max(0, Number(qtyStr.replace(",", ".")) || 0);
  const grams = Math.round(qty * unit.grams * 10) / 10;
  const n = useMemo(() => scaleNutrients(foodPer100(food), grams), [food, grams]);
  const basisUnit = food.basis === "ml" ? "ml" : "g";

  const bump = (dir: 1 | -1) => {
    const step = stepFor(unit);
    const next = Math.max(0, Math.round((qty + dir * step) * 100) / 100);
    setQtyStr(String(next));
  };

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{food.name}</p>
          {food.brand ? <p className="truncate text-sm text-muted-foreground">{food.brand}</p> : null}
        </div>
        {onToggleFavorite ? (
          <Button variant="ghost" size="icon" onClick={onToggleFavorite} aria-pressed={favorite} aria-label={favorite ? "Remove from favourites" : "Add to favourites"}>
            <Heart aria-hidden className={cn(favorite && "fill-primary text-primary")} />
          </Button>
        ) : null}
      </div>

      <div className="rounded-2xl bg-card p-4 ring-1 ring-border" aria-live="polite">
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-bold tabular">{Math.round(n.kcal)}</span>
          <span className="text-sm text-muted-foreground tabular">kcal · {grams} {basisUnit}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div><span className="font-semibold text-protein tabular">{n.protein_g}</span> <span className="text-muted-foreground">g protein</span></div>
          <div><span className="font-semibold text-carbs tabular">{n.carbs_g}</span> <span className="text-muted-foreground">g carbs</span></div>
          <div><span className="font-semibold text-fat tabular">{n.fat_g}</span> <span className="text-muted-foreground">g fat</span></div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground tabular">
          Fibre {n.fiber_g ?? "—"} g · Sugar {n.sugar_g ?? "—"} g · Sat fat {n.sat_fat_g ?? "—"} g · Sodium {n.sodium_mg ?? "—"} mg
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="qty">Amount</Label>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" onClick={() => bump(-1)} aria-label="Decrease amount"><Minus aria-hidden /></Button>
          <Input id="qty" inputMode="decimal" value={qtyStr} onChange={(e) => setQtyStr(e.target.value)} onFocus={(e) => e.target.select()} className="text-center text-lg font-semibold tabular" />
          <Button variant="secondary" size="icon" onClick={() => bump(1)} aria-label="Increase amount"><Plus aria-hidden /></Button>
        </div>
        <div role="radiogroup" aria-label="Unit" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
          {opts.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={unit.id === o.id}
              onClick={() => {
                // Keep the same weight when switching between units
                const newQty = o.grams > 0 ? Math.round((grams / o.grams) * 100) / 100 : qty;
                setUnit(o);
                setQtyStr(String(o.isServing ? Math.max(0.25, Math.round(newQty * 4) / 4) : Math.round(newQty)));
              }}
              className={cn("h-10 shrink-0 rounded-full px-4 text-sm font-medium ring-1", unit.id === o.id ? "bg-primary text-primary-foreground ring-primary" : "bg-card ring-border")}
            >
              {o.label}
              {o.isServing ? <span className="ml-1 opacity-70">({o.grams} {basisUnit})</span> : null}
            </button>
          ))}
        </div>
      </div>

      {mealNames.length > 1 ? (
        <div role="radiogroup" aria-label="Meal" className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-muted p-1">
          {mealNames.map((m, i) => (
            <button key={m} type="button" role="radio" aria-checked={meal === i} onClick={() => setMeal(i)} className={cn("h-10 truncate rounded-full px-2 text-sm font-medium", meal === i ? "bg-card shadow-sm" : "text-muted-foreground")}>
              {m}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        {secondaryAction}
        <Button size="lg" className="flex-1" disabled={grams <= 0 || busy} onClick={() => onConfirm({ grams, quantity: qty, servingName: unit.label, meal, nutrients: n })}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
