"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface QuickValues {
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal: number;
}

const num = (s: string) => {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Calories with optional macros. */
export function QuickForm({ mealNames, initial, initialMeal, confirmLabel = "Add", onConfirm, secondaryAction, busy }: {
  mealNames: string[];
  initial?: Partial<QuickValues>;
  initialMeal: number;
  confirmLabel?: string;
  onConfirm: (v: QuickValues) => void;
  secondaryAction?: React.ReactNode;
  busy?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kcal, setKcal] = useState(initial?.kcal != null ? String(initial.kcal) : "");
  const [p, setP] = useState(initial?.protein_g ? String(initial.protein_g) : "");
  const [c, setC] = useState(initial?.carbs_g ? String(initial.carbs_g) : "");
  const [f, setF] = useState(initial?.fat_g ? String(initial.fat_g) : "");
  const [meal, setMeal] = useState(initialMeal);
  const macroKcal = num(p) * 4 + num(c) * 4 + num(f) * 9;
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const k = num(kcal) || Math.round(macroKcal);
        if (k <= 0) return;
        onConfirm({ name: name.trim() || "Quick add", kcal: k, protein_g: num(p), carbs_g: num(c), fat_g: num(f), meal });
      }}
    >
      <Field label="Calories" htmlFor="q-kcal" hint={!kcal && macroKcal > 0 ? `≈ ${Math.round(macroKcal)} kcal from macros` : undefined}>
        <Input id="q-kcal" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder={macroKcal > 0 ? String(Math.round(macroKcal)) : "e.g. 450"} className="text-lg font-semibold" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Protein g" htmlFor="q-p"><Input id="q-p" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} /></Field>
        <Field label="Carbs g" htmlFor="q-c"><Input id="q-c" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} /></Field>
        <Field label="Fat g" htmlFor="q-f"><Input id="q-f" inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} /></Field>
      </div>
      <Field label="Description (optional)" htmlFor="q-name">
        <Input id="q-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Restaurant lunch" maxLength={200} />
      </Field>
      <div role="radiogroup" aria-label="Meal" className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-muted p-1">
        {mealNames.map((m, i) => (
          <button key={m} type="button" role="radio" aria-checked={meal === i} onClick={() => setMeal(i)} className={cn("h-10 truncate rounded-full px-2 text-sm font-medium", meal === i ? "bg-card shadow-sm" : "text-muted-foreground")}>
            {m}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {secondaryAction}
        <Button type="submit" size="lg" className="flex-1" disabled={busy || (num(kcal) <= 0 && macroKcal <= 0)}>{confirmLabel}</Button>
      </div>
    </form>
  );
}
