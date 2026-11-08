"use client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ChefHat, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddEntries, useProfile, useToday } from "@/lib/data/hooks";
import { useDeleteSavedMeal, useRecipes, useSavedMeals, useTouchSavedMeal, type SavedMeal } from "@/lib/data/recipes";
import { copyEntries } from "@/lib/foods/copy";
import { mealForHour } from "@/lib/foods/log";
import { uuid } from "@/lib/utils";

type Tab = "recipes" | "meals";

export function RecipesScreen() {
  const [tab, setTab] = useState<Tab>("recipes");
  const recipes = useRecipes();
  const meals = useSavedMeals();
  return (
    <main className="px-4 pb-8">
      <PageHeader title="Recipes & meals" back="/more" right={tab === "recipes" ? <Button asChild size="sm"><Link href="/recipes/new"><Plus aria-hidden /> New</Link></Button> : null} />
      <Segmented<Tab> label="Show" value={tab} onChange={setTab} options={[{ value: "recipes", label: "Recipes" }, { value: "meals", label: "Saved meals" }]} />
      <div className="pt-4">
        {tab === "recipes" ? (
          recipes.isPending ? <Skeleton className="h-40" /> : recipes.data?.length ? (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card ring-1 ring-border/70">
              {recipes.data.map((r) => (
                <li key={r.id} className="flex items-center gap-2 pr-2">
                  <Link href={`/recipes/${r.id}`} className="flex min-h-14 min-w-0 flex-1 flex-col justify-center px-4 py-2">
                    <span className="truncate text-[15px]">{r.name}</span>
                    <span className="text-xs text-muted-foreground">{Number(r.servings)} servings</span>
                  </Link>
                  {r.food_id ? <Button asChild variant="secondary" size="sm"><Link href={`/log?food=${r.food_id}`}>Log</Link></Button> : null}
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={<ChefHat className="mx-auto size-8 text-primary" aria-hidden />} title="No recipes yet" body="Add ingredients once and Ember works out the calories and macros per serving. Recipes show up in food search." action={<Button asChild><Link href="/recipes/new">Create a recipe</Link></Button>} />
          )
        ) : meals.isPending ? <Skeleton className="h-40" /> : meals.data?.length ? (
          <ul className="grid gap-2">
            {meals.data.map((m) => <SavedMealCard key={m.id} meal={m} />)}
          </ul>
        ) : (
          <Empty icon={<UtensilsCrossed className="mx-auto size-8 text-primary" aria-hidden />} title="No saved meals yet" body="On Today, tap a meal's ⋯ menu and choose “Save as meal”. Then log the whole thing in one tap." />
        )}
      </div>
    </main>
  );
}

export function useLogSavedMeal() {
  const add = useAddEntries();
  const touch = useTouchSavedMeal();
  const today = useToday();
  const profile = useProfile();
  const mealCount = profile.data?.meal_names?.length ?? 4;
  return (m: SavedMeal, date = today, meal?: number) => {
    const target = meal ?? m.default_meal ?? mealForHour(new Date().getHours(), mealCount);
    add.mutate(copyEntries(m.saved_meal_items.map((i) => ({ ...i, meal: target })), date, uuid, target, "saved_meal"));
    touch.mutate(m.id);
    toast.success(`Logged ${m.name} to ${profile.data?.meal_names?.[target] ?? "your diary"}`);
  };
}

function SavedMealCard({ meal }: { meal: SavedMeal }) {
  const log = useLogSavedMeal();
  const del = useDeleteSavedMeal();
  const kcal = meal.saved_meal_items.reduce((s, i) => s + Number(i.kcal), 0);
  return (
    <li className="rounded-2xl bg-card p-4 ring-1 ring-border/70">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{meal.name}</p>
          <p className="text-xs text-muted-foreground tabular">{Math.round(kcal)} kcal · {meal.saved_meal_items.length} items</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" aria-label={`Delete ${meal.name}`} onClick={() => del.mutate(meal.id)}><Trash2 aria-hidden /></Button>
          <Button size="sm" onClick={() => log(meal)}>Log</Button>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{meal.saved_meal_items.map((i) => i.name).join(", ")}</p>
    </li>
  );
}

function Empty({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="grid gap-2 rounded-2xl bg-card px-6 py-8 text-center ring-1 ring-border/70">
      {icon}
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
