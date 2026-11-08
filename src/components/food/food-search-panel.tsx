"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { FoodRow, RowList, SectionLabel } from "@/components/log/food-rows";
import { useDebounced } from "@/hooks/use-debounce";
import { cacheOnlineFood, fetchFood, useLocalFoodSearch, useOnlineFoodSearch, useRecents } from "@/lib/data/hooks";
import type { FoodWithServings } from "@/lib/data/types";
import { byFrequent, matchScore } from "@/lib/foods/recents";

/** Compact food search (recents → saved/cached → online) that resolves to a stored food. */
export function FoodSearchPanel({ onPick, excludeIds = [] }: { onPick: (f: FoodWithServings) => void; excludeIds?: string[] }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const dqo = useDebounced(q, 450);
  const recents = useRecents();
  const local = useLocalFoodSearch(dq);
  const online = useOnlineFoodSearch(dqo);
  const [busy, setBusy] = useState(false);
  const searching = dq.trim().length >= 2;

  const localList = useMemo(
    () =>
      (local.data ?? [])
        .filter((f) => !excludeIds.includes(f.id))
        .map((f) => ({ f, s: matchScore(dq, f.name, f.brand) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 12)
        .map((x) => x.f),
    [local.data, dq, excludeIds],
  );
  const recentList = useMemo(() => [...(recents.data ?? [])].filter((r) => r.foodId && !excludeIds.includes(r.foodId)).sort(byFrequent).slice(0, 12), [recents.data, excludeIds]);

  const pickId = async (id: string) => {
    const f = await fetchFood(qc, id);
    if (f) onPick(f);
  };

  return (
    <div className="grid gap-1">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input type="search" aria-label="Search ingredients" placeholder="Search foods…" value={q} onChange={(e) => setQ(e.target.value)} className="h-12 w-full rounded-full bg-muted pr-4 pl-11 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      {!searching ? (
        <>
          <SectionLabel>Frequent</SectionLabel>
          {recentList.length ? (
            <RowList>
              {recentList.map((r) => <FoodRow key={r.key} name={r.name} sub={r.brand} kcal={null} onSelect={() => void pickId(r.foodId!)} />)}
            </RowList>
          ) : (
            <p className="px-1 text-sm text-muted-foreground">Search for an ingredient above.</p>
          )}
        </>
      ) : (
        <>
          <SectionLabel>Foods</SectionLabel>
          {local.isPending ? <Skeleton className="h-14" /> : localList.length ? (
            <RowList>{localList.map((f) => <FoodRow key={f.id} name={f.name} sub={f.brand} kcal={null} onSelect={() => onPick(f)} />)}</RowList>
          ) : <p className="px-1 text-sm text-muted-foreground">No saved matches.</p>}
          <SectionLabel>Online</SectionLabel>
          {online.isFetching && !online.data ? <Skeleton className="h-14" /> : (online.data?.results ?? []).length ? (
            <RowList>
              {(online.data?.results ?? []).slice(0, 15).map((f) => (
                <FoodRow
                  key={`${f.source}:${f.sourceId}`}
                  online
                  name={f.name}
                  sub={[f.brand, `${Math.round(f.per100.kcal)} kcal / 100 ${f.basis}`].filter(Boolean).join(" · ")}
                  kcal={null}
                  onSelect={async () => {
                    if (busy) return;
                    setBusy(true);
                    try {
                      onPick(await cacheOnlineFood(qc, f));
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Couldn't add that food");
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              ))}
            </RowList>
          ) : dqo.trim().length >= 3 ? <p className="px-1 text-sm text-muted-foreground">No online results.</p> : null}
        </>
      )}
    </div>
  );
}
