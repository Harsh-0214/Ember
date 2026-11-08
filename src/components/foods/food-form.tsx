"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/data/keys";
import type { FoodWithServings } from "@/lib/data/types";
import { customFoodInputSchema } from "@/lib/schemas/food";

type Basis = "g" | "ml";
type Per = "serving" | "100";

const NUTRIENTS = [
  { key: "kcal", label: "Calories", unit: "kcal", required: true },
  { key: "protein_g", label: "Protein", unit: "g", required: true },
  { key: "carbs_g", label: "Carbs", unit: "g", required: true },
  { key: "fat_g", label: "Fat", unit: "g", required: true },
  { key: "fiber_g", label: "Fibre", unit: "g" },
  { key: "sugar_g", label: "Sugar", unit: "g" },
  { key: "sat_fat_g", label: "Sat. fat", unit: "g" },
  { key: "sodium_mg", label: "Sodium", unit: "mg" },
] as const;
type NKey = (typeof NUTRIENTS)[number]["key"];

const toNum = (s: string): number | null => {
  if (!s.trim()) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function FoodForm({ food, initialName, initialBarcode, afterSaveHref }: { food?: FoodWithServings; initialName?: string; initialBarcode?: string; afterSaveHref?: (id: string) => string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const firstServing = food?.food_servings?.[0];
  const [name, setName] = useState(food?.name ?? initialName ?? "");
  const [brand, setBrand] = useState(food?.brand ?? "");
  const [barcode, setBarcode] = useState(food?.barcode ?? initialBarcode ?? "");
  const [basis, setBasis] = useState<Basis>((food?.basis as Basis) ?? "g");
  const [per, setPer] = useState<Per>(food ? "100" : "serving");
  const [servingName, setServingName] = useState(firstServing?.name ?? "1 serving");
  const [servingSize, setServingSize] = useState(firstServing ? String(firstServing.grams) : "");
  const [values, setValues] = useState<Record<NKey, string>>(() => {
    const v = {} as Record<NKey, string>;
    for (const n of NUTRIENTS) v[n.key] = food && food[n.key] != null ? String(food[n.key]) : "";
    return v;
  });
  const [extra, setExtra] = useState<{ name: string; grams: string }[]>(() => (food?.food_servings ?? []).slice(1).map((s) => ({ name: s.name, grams: String(s.grams) })));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const size = toNum(servingSize);
    if (per === "serving" && (!size || size <= 0)) return setError(`Enter the serving size in ${basis}.`);
    const factor = per === "serving" ? 100 / size! : 1;
    const per100: Record<string, number | null> = {};
    for (const n of NUTRIENTS) {
      const v = toNum(values[n.key]);
      per100[n.key] = v == null ? ("required" in n ? 0 : null) : Math.round(v * factor * 100) / 100;
    }
    if (toNum(values.kcal) == null) return setError("Calories are required.");
    const servings = [
      ...(size && size > 0 ? [{ name: servingName.trim() || "1 serving", grams: size }] : []),
      ...extra.map((x) => ({ name: x.name.trim(), grams: toNum(x.grams) ?? 0 })).filter((x) => x.name && x.grams > 0),
    ];
    const parsed = customFoodInputSchema.safeParse({ name, brand, barcode: barcode || null, basis, per100, servings });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the values");
    setSaving(true);
    try {
      const res = food ? await api.patch<{ food: FoodWithServings }>(`/api/foods/${food.id}`, parsed.data) : await api.post<{ food: FoodWithServings }>("/api/foods", parsed.data);
      qc.setQueryData(qk.food(res.food.id), res.food);
      void qc.invalidateQueries({ queryKey: qk.myFoods });
      void qc.invalidateQueries({ queryKey: ["foods-local"] });
      toast.success(food ? "Food updated" : "Food created");
      router.replace(afterSaveHref ? afterSaveHref(res.food.id) : "/log");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
      setSaving(false);
    }
  }

  async function remove() {
    if (!food) return;
    setSaving(true);
    try {
      await api.del(`/api/foods/${food.id}`);
      void qc.invalidateQueries({ queryKey: qk.myFoods });
      toast.success("Food deleted");
      router.replace("/log");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 pb-8" noValidate>
      <Field label="Name" htmlFor="f-name"><Input id="f-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} placeholder="e.g. Homemade granola" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Brand (optional)" htmlFor="f-brand"><Input id="f-brand" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={200} /></Field>
        <Field label="Barcode (optional)" htmlFor="f-bc"><Input id="f-bc" inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ""))} maxLength={14} /></Field>
      </div>
      <Segmented<Basis> label="Measured by" value={basis} onChange={setBasis} options={[{ value: "g", label: "Weight (g)" }, { value: "ml", label: "Volume (ml)" }]} />
      <div className="grid gap-2">
        <span className="text-sm font-medium">Nutrition facts are per</span>
        <Segmented<Per> label="Nutrition basis" value={per} onChange={setPer} options={[{ value: "serving", label: "Serving" }, { value: "100", label: `100 ${basis}` }]} />
      </div>
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <Field label="Serving name" htmlFor="f-sn"><Input id="f-sn" value={servingName} onChange={(e) => setServingName(e.target.value)} maxLength={100} /></Field>
        <Field label={`Size (${basis})`} htmlFor="f-ss"><Input id="f-ss" inputMode="decimal" value={servingSize} onChange={(e) => setServingSize(e.target.value)} placeholder="30" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
        {NUTRIENTS.map((n) => (
          <Field key={n.key} label={`${n.label} (${n.unit})`} htmlFor={`f-${n.key}`}>
            <Input id={`f-${n.key}`} inputMode="decimal" value={values[n.key]} onChange={(e) => setValues((v) => ({ ...v, [n.key]: e.target.value }))} placeholder={"required" in n ? "0" : "—"} />
          </Field>
        ))}
      </div>
      <div className="grid gap-2">
        <span className="text-sm font-medium">More servings (optional)</span>
        {extra.map((x, i) => (
          <div key={i} className="grid grid-cols-[1fr_6rem_auto] items-center gap-2">
            <Input aria-label="Serving name" value={x.name} onChange={(e) => setExtra((l) => l.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} placeholder="1 cup" />
            <Input aria-label={`Serving size in ${basis}`} inputMode="decimal" value={x.grams} onChange={(e) => setExtra((l) => l.map((y, j) => (j === i ? { ...y, grams: e.target.value } : y)))} placeholder={basis} />
            <Button variant="ghost" size="icon" aria-label="Remove serving" onClick={() => setExtra((l) => l.filter((_, j) => j !== i))}><Trash2 aria-hidden /></Button>
          </div>
        ))}
        <Button variant="outline" onClick={() => setExtra((l) => [...l, { name: "", grams: "" }])}><Plus aria-hidden /> Add serving</Button>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" size="lg" disabled={saving}>{saving ? "Saving…" : food ? "Save changes" : "Save food"}</Button>
      {food ? <Button variant="ghost" className="text-destructive" onClick={remove} disabled={saving}><Trash2 aria-hidden /> Delete food</Button> : null}
    </form>
  );
}
