"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { FoodEntry } from "@/lib/data/types";
import { EntryRow } from "./entry-row";

export function MealSection({ name, index, date, entries, onEdit, onDelete }: { name: string; index: number; date: string; entries: FoodEntry[]; onEdit: (e: FoodEntry) => void; onDelete: (e: FoodEntry) => void }) {
  const kcal = entries.reduce((s, e) => s + Number(e.kcal), 0);
  return (
    <section aria-labelledby={`meal-${index}`} className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/70">
      <div className="flex items-center justify-between py-1 pl-4 pr-1">
        <h2 id={`meal-${index}`} className="text-[15px] font-semibold">
          {name}
          <span className="ml-2 font-normal text-muted-foreground tabular">{kcal > 0 ? `${Math.round(kcal)} kcal` : ""}</span>
        </h2>
        <Link href={`/log?meal=${index}&date=${date}`} aria-label={`Add food to ${name}`} className="grid size-11 place-items-center rounded-full text-primary hover:bg-muted">
          <Plus className="size-6" aria-hidden />
        </Link>
      </div>
      {entries.length > 0 ? (
        <ul className="divide-y divide-border border-t">
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} onEdit={() => onEdit(e)} onDelete={() => onDelete(e)} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
