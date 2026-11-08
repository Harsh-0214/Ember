"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Copy, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/drawer";
import { Field, Input } from "@/components/ui/input";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAddEntries } from "@/lib/data/hooks";
import { useSaveSavedMeal } from "@/lib/data/recipes";
import { qk } from "@/lib/data/keys";
import type { FoodEntry } from "@/lib/data/types";
import { addDays, friendlyDate } from "@/lib/dates";
import { copyEntries } from "@/lib/foods/copy";
import { describeAmount } from "@/lib/foods/amount";
import { cn, uuid } from "@/lib/utils";

async function loadDay(date: string): Promise<FoodEntry[]> {
  const { data, error } = await getSupabaseBrowser().from("food_entries").select("*").eq("date", date).order("logged_at");
  if (error) throw new Error(error.message);
  return data as FoodEntry[];
}

/** Copy-from-day and save-as-meal actions for one meal. */
export function MealActionsSheet({ open, onOpenChange, date, today, meal, mealNames, entries }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  date: string;
  today: string;
  meal: number;
  mealNames: string[];
  entries: FoodEntry[];
}) {
  const [mode, setMode] = useState<"menu" | "copy" | "save">("menu");
  const [from, setFrom] = useState(addDays(date, -1));
  const [fromMeal, setFromMeal] = useState(meal);
  const [name, setName] = useState(`${mealNames[meal] ?? "Meal"} ${friendlyDate(date, today).toLowerCase() === "today" ? "" : `(${date})`}`.trim());
  const add = useAddEntries();
  const saveMeal = useSaveSavedMeal();
  const source = useQuery({ queryKey: qk.diary(from), queryFn: () => loadDay(from), enabled: open && mode === "copy" });
  const fromEntries = (source.data ?? []).filter((e) => e.meal === fromMeal);
  const close = () => {
    onOpenChange(false);
    setMode("menu");
  };

  const copyYesterday = async () => {
    const y = await loadDay(addDays(date, -1));
    const list = y.filter((e) => e.meal === meal);
    if (!list.length) return toast(`Nothing logged for ${mealNames[meal]} yesterday`);
    add.mutate(copyEntries(list, date, uuid, meal));
    toast.success(`Copied ${list.length} item${list.length === 1 ? "" : "s"} from yesterday`);
    close();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())} title={mode === "copy" ? `Copy into ${mealNames[meal]}` : mode === "save" ? "Save as meal" : mealNames[meal] ?? "Meal"}>
      {mode === "menu" ? (
        <div className="grid gap-2">
          <Button variant="secondary" size="lg" className="justify-start" onClick={() => void copyYesterday()}><Copy aria-hidden /> Copy yesterday&apos;s {mealNames[meal]?.toLowerCase()}</Button>
          <Button variant="secondary" size="lg" className="justify-start" onClick={() => setMode("copy")}><CalendarDays aria-hidden /> Copy from another day…</Button>
          <Button variant="secondary" size="lg" className="justify-start" disabled={!entries.length} onClick={() => setMode("save")}><Save aria-hidden /> Save as meal{entries.length ? "" : " (log something first)"}</Button>
        </div>
      ) : mode === "copy" ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="From day" htmlFor="copy-date"><Input id="copy-date" type="date" value={from} max={today} onChange={(e) => e.target.value && setFrom(e.target.value)} /></Field>
            <Field label="From meal" htmlFor="copy-meal">
              <select id="copy-meal" value={fromMeal} onChange={(e) => setFromMeal(Number(e.target.value))} className="h-11 rounded-xl border border-input bg-card px-3">
                {mealNames.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </Field>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card ring-1 ring-border/70" aria-live="polite">
            {source.isPending ? <li className="p-4 text-sm text-muted-foreground">Loading…</li> : fromEntries.length ? fromEntries.map((e) => (
              <li key={e.id} className="flex justify-between gap-2 px-4 py-2.5 text-sm"><span className="truncate">{e.name} <span className="text-muted-foreground">· {describeAmount(e)}</span></span><span className="tabular">{Math.round(Number(e.kcal))}</span></li>
            )) : <li className="p-4 text-sm text-muted-foreground">Nothing logged for {mealNames[fromMeal]} on {friendlyDate(from, today)}.</li>}
          </ul>
          <Button size="lg" disabled={!fromEntries.length} onClick={() => { add.mutate(copyEntries(fromEntries, date, uuid, meal)); toast.success(`Copied ${fromEntries.length} item${fromEntries.length === 1 ? "" : "s"}`); close(); }}>
            Copy {fromEntries.length || ""} item{fromEntries.length === 1 ? "" : "s"}
          </Button>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={async (e) => {
          e.preventDefault();
          await saveMeal.mutateAsync({ name: name.trim() || (mealNames[meal] ?? "Meal"), default_meal: meal, items: entries.map((x) => ({ food_id: x.food_id, name: x.name, brand: x.brand, grams: x.grams == null ? null : Number(x.grams), serving_name: x.serving_name, quantity: x.quantity == null ? null : Number(x.quantity), kcal: Number(x.kcal), protein_g: Number(x.protein_g), carbs_g: Number(x.carbs_g), fat_g: Number(x.fat_g), fiber_g: x.fiber_g, sugar_g: x.sugar_g, sat_fat_g: x.sat_fat_g, sodium_mg: x.sodium_mg })) });
          toast.success("Meal saved. Log it in one tap from search");
          close();
        }}>
          <Field label="Meal name" htmlFor="sm-name"><Input id="sm-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} placeholder="My usual breakfast" /></Field>
          <p className={cn("text-sm text-muted-foreground")}>{entries.length} items · {Math.round(entries.reduce((s, x) => s + Number(x.kcal), 0))} kcal</p>
          <Button type="submit" size="lg" disabled={saveMeal.isPending}>Save meal</Button>
        </form>
      )}
    </Sheet>
  );
}
