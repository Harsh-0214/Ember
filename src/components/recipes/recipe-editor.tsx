"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/drawer";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FoodSearchPanel } from "@/components/food/food-search-panel";
import { ServingPicker } from "@/components/food/serving-picker";
import { useUnits } from "@/lib/data/hooks";
import { useDeleteRecipe, useRecipe, useSaveRecipe } from "@/lib/data/recipes";
import type { FoodWithServings } from "@/lib/data/types";
import { describeAmount, foodPer100 } from "@/lib/foods/amount";
import { computeRecipe } from "@/lib/foods/recipe";

interface Item {
  key: string;
  food: FoodWithServings;
  grams: number;
  serving_name: string | null;
  quantity: number | null;
}

export function RecipeEditorScreen({ id }: { id?: string }) {
  const recipe = useRecipe(id ?? null);
  if (id && recipe.isPending) {
    return (
      <main className="px-4"><PageHeader title="Recipe" back="/recipes" /><div className="grid gap-3"><Skeleton className="h-12" /><Skeleton className="h-40" /></div></main>
    );
  }
  if (id && !recipe.data) return <main className="px-4"><PageHeader title="Recipe" back="/recipes" /><p className="text-muted-foreground">Recipe not found.</p></main>;
  return <RecipeEditor key={id ?? "new"} id={id} initial={recipe.data ?? null} />;
}

function RecipeEditor({ id, initial }: { id?: string; initial: ReturnType<typeof useRecipe>["data"] }) {
  const router = useRouter();
  const units = useUnits();
  const save = useSaveRecipe();
  const del = useDeleteRecipe();
  const [name, setName] = useState(initial?.name ?? "");
  const [servings, setServings] = useState(String(initial?.servings ?? 4));
  const [cooked, setCooked] = useState(initial?.total_grams ? String(initial.total_grams) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [items, setItems] = useState<Item[]>(() =>
    (initial?.recipe_items ?? [])
      .filter((i) => i.foods)
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ key: i.id, food: i.foods!, grams: Number(i.grams), serving_name: i.serving_name, quantity: i.quantity == null ? null : Number(i.quantity) })),
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [picking, setPicking] = useState<{ food: FoodWithServings; editKey?: string } | null>(null);

  const s = Number(servings) || 0;
  const calc = useMemo(() => computeRecipe(items.map((i) => ({ grams: i.grams, per100: foodPer100(i.food) })), s || 1, Number(cooked) || null), [items, s, cooked]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Give your recipe a name");
    if (!items.length) return toast.error("Add at least one ingredient");
    if (s <= 0) return toast.error("Servings must be more than 0");
    const res = await save.mutateAsync({
      id,
      input: { name: name.trim(), servings: s, total_grams: Number(cooked) || null, notes: notes.trim() || null, items: items.map((i) => ({ food_id: i.food.id, grams: i.grams, serving_name: i.serving_name, quantity: i.quantity })) },
    });
    toast.success("Recipe saved");
    router.replace(id ? "/recipes" : `/recipes/${res.recipe.id}`);
  };

  return (
    <main className="px-4 pb-10">
      <PageHeader title={id ? "Edit recipe" : "New recipe"} back="/recipes" />
      <div className="grid gap-4">
        <Field label="Name" htmlFor="r-name"><Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Chicken burrito bowls" maxLength={200} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Servings" htmlFor="r-serv"><Input id="r-serv" inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} /></Field>
          <Field label="Cooked weight (g)" htmlFor="r-cooked" hint="Optional: weigh the pot"><Input id="r-cooked" inputMode="decimal" value={cooked} onChange={(e) => setCooked(e.target.value)} placeholder={String(Math.round(calc.rawGrams) || "")} /></Field>
        </div>

        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Per serving ({calc.servingGrams} g)</p>
          <p className="text-3xl font-bold tabular">{Math.round(calc.perServing.kcal)} <span className="text-base font-normal text-muted-foreground">kcal</span></p>
          <p className="mt-1 text-sm tabular">
            <span className="text-protein">{calc.perServing.protein_g} g P</span> · <span className="text-carbs">{calc.perServing.carbs_g} g C</span> · <span className="text-fat">{calc.perServing.fat_g} g F</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular">Whole recipe: {Math.round(calc.totals.kcal)} kcal · {Math.round(calc.totalGrams)} g</p>
        </Card>

        <section aria-labelledby="ingredients">
          <h2 id="ingredients" className="px-1 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Ingredients</h2>
          {items.length ? (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card ring-1 ring-border/70">
              {items.map((i) => (
                <li key={i.key} className="flex items-center">
                  <button type="button" className="flex min-h-14 min-w-0 flex-1 flex-col justify-center px-4 py-2 text-left" onClick={() => setPicking({ food: i.food, editKey: i.key })}>
                    <span className="truncate text-[15px]">{i.food.name}</span>
                    <span className="text-xs text-muted-foreground">{describeAmount({ serving_name: i.serving_name, quantity: i.quantity, grams: i.grams }, i.food.basis)} · {Math.round((Number(i.food.kcal) * i.grams) / 100)} kcal</span>
                  </button>
                  <Button variant="ghost" size="icon" aria-label={`Remove ${i.food.name}`} onClick={() => setItems((l) => l.filter((x) => x.key !== i.key))}><Trash2 aria-hidden /></Button>
                </li>
              ))}
            </ul>
          ) : <p className="px-1 text-sm text-muted-foreground">No ingredients yet.</p>}
          <Button variant="outline" className="mt-2 w-full" onClick={() => setSearchOpen(true)}><Plus aria-hidden /> Add ingredient</Button>
        </section>

        <Field label="Notes (optional)" htmlFor="r-notes"><Textarea id="r-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} /></Field>
        <Button size="lg" onClick={() => void submit()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save recipe"}</Button>
        {id ? (
          <Button variant="ghost" className="text-destructive" onClick={async () => { await del.mutateAsync(id); toast.success("Recipe deleted"); router.replace("/recipes"); }}>
            <Trash2 aria-hidden /> Delete recipe
          </Button>
        ) : null}
      </div>

      <Sheet open={searchOpen} onOpenChange={setSearchOpen} title="Add ingredient">
        <FoodSearchPanel onPick={(f) => { setSearchOpen(false); setPicking({ food: f }); }} />
      </Sheet>
      <Sheet open={picking != null} onOpenChange={(o) => !o && setPicking(null)} title={picking?.editKey ? "Edit ingredient" : "Amount"}>
        {picking ? (
          <ServingPicker
            key={picking.editKey ?? picking.food.id}
            food={picking.food}
            units={units}
            mealNames={[]}
            initialMeal={0}
            initial={picking.editKey ? (() => { const it = items.find((x) => x.key === picking.editKey); return it ? { serving_name: it.serving_name, quantity: it.quantity, grams: it.grams } : null; })() : null}
            confirmLabel={picking.editKey ? "Update" : "Add to recipe"}
            onConfirm={(a) => {
              const next: Item = { key: picking.editKey ?? crypto.randomUUID(), food: picking.food, grams: a.grams, serving_name: a.servingName, quantity: a.quantity };
              setItems((l) => (picking.editKey ? l.map((x) => (x.key === picking.editKey ? next : x)) : [...l, next]));
              setPicking(null);
            }}
          />
        ) : null}
      </Sheet>
    </main>
  );
}
