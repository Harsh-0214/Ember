"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ServingPicker } from "@/components/food/serving-picker";
import { QuickForm } from "@/components/food/quick-form";
import { fetchFood, useDeleteEntry, useUpdateEntry } from "@/lib/data/hooks";
import { qk } from "@/lib/data/keys";
import type { FoodEntry } from "@/lib/data/types";
import type { UnitSystem } from "@/lib/units";

export function EditEntrySheet({ entry, onClose, units, mealNames }: { entry: FoodEntry | null; onClose: () => void; units: UnitSystem; mealNames: string[] }) {
  const qc = useQueryClient();
  const update = useUpdateEntry();
  const del = useDeleteEntry();
  const foodId = entry?.food_id ?? null;
  const food = useQuery({ queryKey: qk.food(foodId ?? "none"), queryFn: () => fetchFood(qc, foodId!), enabled: !!foodId });

  const deleteBtn = entry ? (
    <Button variant="secondary" size="lg" aria-label="Delete entry" onClick={() => { del.removeWithUndo(entry); onClose(); }}>
      <Trash2 aria-hidden />
    </Button>
  ) : null;

  return (
    <Sheet open={entry != null} onOpenChange={(o) => !o && onClose()} title="Edit entry">
      {entry == null ? null : foodId ? (
        food.data ? (
          <ServingPicker
            key={entry.id}
            food={food.data}
            units={units}
            mealNames={mealNames}
            initialMeal={entry.meal}
            initial={entry}
            confirmLabel="Save"
            secondaryAction={deleteBtn}
            onConfirm={(a) => {
              update.mutate({ id: entry.id, date: entry.date, patch: { meal: a.meal, grams: a.grams, quantity: a.quantity, serving_name: a.servingName, ...a.nutrients } });
              onClose();
            }}
          />
        ) : food.isError || (food.isFetched && !food.data) ? (
          <QuickEditor entry={entry} mealNames={mealNames} onClose={onClose} deleteBtn={deleteBtn} />
        ) : (
          <div className="grid gap-3"><Skeleton className="h-24" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        )
      ) : (
        <QuickEditor entry={entry} mealNames={mealNames} onClose={onClose} deleteBtn={deleteBtn} />
      )}
    </Sheet>
  );
}

function QuickEditor({ entry, mealNames, onClose, deleteBtn }: { entry: FoodEntry; mealNames: string[]; onClose: () => void; deleteBtn: React.ReactNode }) {
  const update = useUpdateEntry();
  return (
    <QuickForm
      key={entry.id}
      mealNames={mealNames}
      initialMeal={entry.meal}
      initial={{ name: entry.name, kcal: Number(entry.kcal), protein_g: Number(entry.protein_g), carbs_g: Number(entry.carbs_g), fat_g: Number(entry.fat_g) }}
      confirmLabel="Save"
      secondaryAction={deleteBtn}
      onConfirm={(v) => {
        update.mutate({ id: entry.id, date: entry.date, patch: { name: v.name, kcal: v.kcal, protein_g: v.protein_g, carbs_g: v.carbs_g, fat_g: v.fat_g, meal: v.meal } });
        onClose();
      }}
    />
  );
}
