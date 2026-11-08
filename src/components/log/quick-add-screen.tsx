"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { QuickForm } from "@/components/food/quick-form";
import { PageHeader } from "@/components/shell/page-header";
import { useAddEntries, useProfile, useToday } from "@/lib/data/hooks";
import { buildEntry, mealForHour } from "@/lib/foods/log";
import { isLocalDate } from "@/lib/dates";
import { uuid } from "@/lib/utils";

export function QuickAddScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const today = useToday();
  const profile = useProfile();
  const add = useAddEntries();
  const mealNames = profile.data?.meal_names?.length ? profile.data.meal_names : ["Breakfast", "Lunch", "Dinner", "Snacks"];
  const d = params.get("date");
  const date = d && isLocalDate(d) ? d : today;
  const m = Number(params.get("meal"));
  const meal = Number.isInteger(m) && m >= 0 && m < mealNames.length ? m : mealForHour(new Date().getHours(), mealNames.length);
  const back = date === today ? "/" : `/?date=${date}`;
  return (
    <main className="px-4">
      <PageHeader title="Quick add" back={back} />
      <p className="mb-4 text-sm text-muted-foreground">For restaurant meals or anything you just know the numbers for.</p>
      <QuickForm
        mealNames={mealNames}
        initialMeal={meal}
        onConfirm={(v) => {
          add.mutate([buildEntry({ id: uuid(), date, meal: v.meal, foodId: null, name: v.name, brand: null, grams: null, quantity: null, servingName: null, source: "quick", nutrients: { kcal: v.kcal, protein_g: v.protein_g, carbs_g: v.carbs_g, fat_g: v.fat_g, fiber_g: null, sugar_g: null, sat_fat_g: null, sodium_mg: null } })]);
          toast.success(`Added ${v.kcal} kcal to ${mealNames[v.meal]}`);
          router.push(back);
        }}
      />
    </main>
  );
}
