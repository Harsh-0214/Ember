"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchFood } from "@/lib/data/hooks";
import { qk } from "@/lib/data/keys";
import { FoodForm } from "./food-form";

function logHref(params: URLSearchParams, id: string) {
  const sp = new URLSearchParams();
  sp.set("food", id);
  const meal = params.get("meal");
  const date = params.get("date");
  if (meal) sp.set("meal", meal);
  if (date) sp.set("date", date);
  return `/log?${sp.toString()}`;
}

export function NewFoodScreen() {
  const params = useSearchParams();
  return (
    <main className="px-4">
      <PageHeader title="Create food" back="/log" />
      <FoodForm initialName={params.get("name") ?? undefined} initialBarcode={params.get("barcode") ?? undefined} afterSaveHref={(id) => logHref(params, id)} />
    </main>
  );
}

export function EditFoodScreen({ id }: { id: string }) {
  const qc = useQueryClient();
  const food = useQuery({ queryKey: qk.food(id), queryFn: () => fetchFood(qc, id) });
  return (
    <main className="px-4">
      <PageHeader title="Edit food" back="/log" />
      {food.isPending ? (
        <div className="grid gap-3"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-48" /></div>
      ) : food.data && food.data.user_id ? (
        <FoodForm food={food.data} afterSaveHref={() => "/log"} />
      ) : (
        <p className="text-muted-foreground">This food can&apos;t be edited (it&apos;s from a shared database).</p>
      )}
    </main>
  );
}
