"use client";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, PencilLine, ScanBarcode, Search, X, Zap } from "lucide-react";
import { Sheet } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/ui/segmented";
import { ServingPicker, type PickedAmount } from "@/components/food/serving-picker";
import { useDebounced } from "@/hooks/use-debounce";
import {
  cacheOnlineFood, fetchFood, useAddEntries, useDeleteEntry, useFavorites, useLocalFoodSearch, useMyFoods, useOnlineFoodSearch,
  useProfile, useRecents, useToday, useToggleFavorite, type RecentEntry,
} from "@/lib/data/hooks";
import type { FoodEntry, FoodWithServings } from "@/lib/data/types";
import { describeAmount, type FoodLike } from "@/lib/foods/amount";
import { buildEntry, mealForHour, normalizedToFoodLike } from "@/lib/foods/log";
import { byFrequent, byRecent, matchScore, type RecentFood } from "@/lib/foods/recents";
import { friendlyDate, isLocalDate } from "@/lib/dates";
import type { NormalizedFood } from "@/lib/schemas/food";
import type { UnitSystem } from "@/lib/units";
import { haptic, uuid } from "@/lib/utils";
import { FoodRow, RowList, SectionLabel } from "./food-rows";
import { useSavedMeals, type SavedMeal } from "@/lib/data/recipes";
import { useLogSavedMeal } from "@/components/recipes/recipes-screen";

type Tab = "recent" | "frequent" | "favorites" | "mine";

type Picking =
  | { kind: "local"; food: FoodWithServings; last: RecentEntry | null }
  | { kind: "online"; food: NormalizedFood; like: FoodLike & { name: string; brand: string | null } };

const fmtSub = (brand: string | null | undefined, extra?: string | null) => [brand, extra].filter(Boolean).join(" · ");
const per100Label = (f: { basis: string; kcal: number }) => `${Math.round(Number(f.kcal))} kcal / 100 ${f.basis === "ml" ? "ml" : "g"}`;

export function LogScreen() {
  const params = useSearchParams();
  const qc = useQueryClient();
  const today = useToday();
  const profile = useProfile();
  const units: UnitSystem = profile.data?.units === "imperial" ? "imperial" : "metric";
  const mealNames = profile.data?.meal_names?.length ? profile.data.meal_names : ["Breakfast", "Lunch", "Dinner", "Snacks"];
  const dateParam = params.get("date");
  const date = dateParam && isLocalDate(dateParam) ? dateParam : today;
  const mealParam = Number(params.get("meal"));
  const defaultMeal = Number.isInteger(mealParam) && mealParam >= 0 && mealParam < mealNames.length ? mealParam : mealForHour(new Date().getHours(), mealNames.length);

  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const dqOnline = useDebounced(q, 450);
  const [tab, setTab] = useState<Tab>("recent");
  const [picking, setPicking] = useState<Picking | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const recents = useRecents();
  const favorites = useFavorites();
  const myFoods = useMyFoods();
  const local = useLocalFoodSearch(dq);
  const online = useOnlineFoodSearch(dqOnline);
  const add = useAddEntries();
  const del = useDeleteEntry();
  const fav = useToggleFavorite();
  const savedMeals = useSavedMeals();
  const logSaved = useLogSavedMeal();
  const logMeal = (m: SavedMeal) => {
    logSaved(m, date, defaultMeal);
    setAdded((n) => n + 1);
  };
  const mealRow = (m: SavedMeal) => (
    <FoodRow
      key={m.id}
      name={m.name}
      sub={`Saved meal · ${m.saved_meal_items.length} items`}
      kcal={m.saved_meal_items.reduce((a, i) => a + Number(i.kcal), 0)}
      onSelect={() => logMeal(m)}
      onQuickAdd={() => logMeal(m)}
      quickLabel={`Log saved meal ${m.name}`}
    />
  );

  // Open a specific food directly (?food=<id>, e.g. after creating a custom food or scanning).
  const foodParam = params.get("food");
  useEffect(() => {
    if (!foodParam) return;
    void fetchFood(qc, foodParam).then((f) => f && setPicking({ kind: "local", food: f, last: null }));
  }, [foodParam, qc]);

  const recentByFood = useMemo(() => new Map((recents.data ?? []).filter((r) => r.foodId).map((r) => [r.foodId!, r])), [recents.data]);
  const favoriteIds = useMemo(() => new Set((favorites.data ?? []).map((f) => f.id)), [favorites.data]);

  const logEntry = (entry: ReturnType<typeof buildEntry>) => {
    haptic();
    add.mutate([entry]);
    setAdded((n) => n + 1);
    toast.success(`Added ${entry.name} to ${mealNames[entry.meal] ?? "diary"}`, {
      duration: 3500,
      action: {
        label: "Undo",
        onClick: () => del.mutate({ ...entry, user_id: "", external_id: null, created_at: "", updated_at: "", logged_at: entry.logged_at ?? "" } as FoodEntry),
      },
    });
  };

  /** One-tap: repeat the last logged amount of a recent food. */
  const quickLogRecent = (r: RecentFood<RecentEntry>, meal = defaultMeal) => {
    const l = r.last;
    logEntry(
      buildEntry({
        id: uuid(), date, meal, foodId: l.food_id, name: l.name, brand: l.brand, grams: l.grams, quantity: l.quantity, servingName: l.serving_name,
        nutrients: { kcal: Number(l.kcal), protein_g: Number(l.protein_g), carbs_g: Number(l.carbs_g), fat_g: Number(l.fat_g), fiber_g: l.fiber_g, sugar_g: l.sugar_g, sat_fat_g: l.sat_fat_g, sodium_mg: l.sodium_mg },
        source: l.food_id ? "manual" : "quick",
      }),
    );
  };

  const openRecent = async (r: RecentFood<RecentEntry>) => {
    if (!r.foodId) return quickLogRecent(r);
    const f = await fetchFood(qc, r.foodId);
    if (f) setPicking({ kind: "local", food: f, last: r.last });
    else quickLogRecent(r);
  };
  const prefetch = (id: string | null) => id && void fetchFood(qc, id);

  const confirm = async (a: PickedAmount) => {
    if (!picking) return;
    if (picking.kind === "local") {
      const f = picking.food;
      logEntry(buildEntry({ id: uuid(), date, meal: a.meal, foodId: f.id, name: f.name, brand: f.brand, grams: a.grams, quantity: a.quantity, servingName: a.servingName, nutrients: a.nutrients, source: f.source === "recipe" ? "recipe" : "manual" }));
      setPicking(null);
      return;
    }
    // Online result: cache it first so it's local next time (and works offline).
    setBusy(true);
    let foodId: string | null = null;
    try {
      foodId = (await cacheOnlineFood(qc, picking.food)).id;
    } catch {
      foodId = null; // still log the entry; nutrition is snapshotted
    }
    setBusy(false);
    logEntry(buildEntry({ id: uuid(), date, meal: a.meal, foodId, name: picking.food.name, brand: picking.food.brand, grams: a.grams, quantity: a.quantity, servingName: a.servingName, nutrients: a.nutrients }));
    setPicking(null);
  };

  // ---- result assembly
  const query = dq.trim();
  const searching = query.length >= 2;
  const recentMatches = useMemo(() => {
    if (!searching) return [];
    return (recents.data ?? [])
      .map((r) => ({ r, s: matchScore(query, r.name, r.brand, r.count) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map((x) => x.r);
  }, [recents.data, query, searching]);
  const localMatches = useMemo(() => {
    if (!searching) return [];
    const seen = new Set(recentMatches.map((r) => r.foodId));
    return (local.data ?? [])
      .filter((f) => !seen.has(f.id))
      .map((f) => ({ f, s: matchScore(query, f.name, f.brand, recentByFood.get(f.id)?.count ?? 0) + (favoriteIds.has(f.id) ? 30 : 0) + (f.user_id ? 15 : 0) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 15)
      .map((x) => x.f);
  }, [local.data, query, searching, recentMatches, recentByFood, favoriteIds]);
  const onlineMatches = useMemo(() => {
    if (!searching) return [];
    const localKeys = new Set((local.data ?? []).filter((f) => f.source_id).map((f) => `${f.source}:${f.source_id}`));
    return (online.data?.results ?? []).filter((f) => !localKeys.has(`${f.source}:${f.sourceId}`));
  }, [online.data, local.data, searching]);

  const savedMatches = useMemo(
    () => (searching ? (savedMeals.data ?? []).filter((m) => matchScore(query, m.name) > 0).slice(0, 5) : []),
    [savedMeals.data, query, searching],
  );

  const tabList = useMemo(() => {
    const r = recents.data ?? [];
    if (tab === "recent") return [...r].sort(byRecent).slice(0, 30);
    if (tab === "frequent") return [...r].sort(byFrequent).slice(0, 30);
    return [];
  }, [recents.data, tab]);

  const backHref = date === today ? "/" : `/?date=${date}`;

  return (
    <main className="px-4">
      <div className="sticky top-0 z-30 -mx-4 bg-background/95 px-4 pt-safe pb-2 backdrop-blur-xl">
        <div className="flex h-12 items-center gap-1">
          <Link href={backHref} aria-label="Back to diary" className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-muted">
            <ChevronLeft className="size-6" aria-hidden />
          </Link>
          <h1 className="flex-1 truncate text-[17px] font-semibold">
            Add to {mealNames[defaultMeal]} <span className="font-normal text-muted-foreground">· {friendlyDate(date, today)}</span>
          </h1>
          {added > 0 ? (
            <Link href={backHref} className="h-10 rounded-full bg-primary px-4 text-sm leading-10 font-semibold text-primary-foreground">Done</Link>
          ) : null}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Search foods"
            placeholder="Search foods, brands, recipes…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-12 w-full rounded-full bg-muted pr-11 pl-11 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
          />
          {q ? (
            <button type="button" aria-label="Clear search" onClick={() => { setQ(""); inputRef.current?.focus(); }} className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center text-muted-foreground">
              <X className="size-5" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      {!searching ? (
        <>
          <div className="grid grid-cols-3 gap-2 pt-2">
            <Link href={`/log/scan?meal=${defaultMeal}&date=${date}`} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-card text-sm font-medium ring-1 ring-border"><ScanBarcode className="size-5 text-primary" aria-hidden />Scan</Link>
            <Link href={`/log/quick?meal=${defaultMeal}&date=${date}`} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-card text-sm font-medium ring-1 ring-border"><Zap className="size-5 text-primary" aria-hidden />Quick add</Link>
            <Link href={`/foods/new?meal=${defaultMeal}&date=${date}`} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-card text-sm font-medium ring-1 ring-border"><PencilLine className="size-5 text-primary" aria-hidden />Create food</Link>
          </div>
          <Segmented<Tab>
            className="mt-4"
            label="Food lists"
            value={tab}
            onChange={setTab}
            options={[
              { value: "recent", label: "Recent" },
              { value: "frequent", label: "Frequent" },
              { value: "favorites", label: "Favourites" },
              { value: "mine", label: "Mine" },
            ]}
          />
          <div className="pt-3 pb-6">
            {tab === "recent" || tab === "frequent" ? (
              recents.isPending ? (
                <ListSkeleton />
              ) : tabList.length ? (
                <RowList>
                  {tabList.map((r) => (
                    <FoodRow
                      key={r.key}
                      name={r.name}
                      sub={fmtSub(r.brand, describeAmount(r.last))}
                      kcal={Number(r.last.kcal)}
                      onPointerDown={() => prefetch(r.foodId)}
                      onSelect={() => void openRecent(r)}
                      onQuickAdd={() => quickLogRecent(r)}
                      quickLabel={`Log ${r.name}, ${describeAmount(r.last)}`}
                    />
                  ))}
                </RowList>
              ) : (
                <Empty title="Nothing logged yet" body="Search above for anything you ate. Foods you log show up here for one-tap logging next time." />
              )
            ) : tab === "favorites" ? (
              favorites.isPending ? (
                <ListSkeleton />
              ) : favorites.data?.length ? (
                <RowList>
                  {favorites.data.map((f) => (
                    <FoodRow key={f.id} name={f.name} sub={fmtSub(f.brand, per100Label(f))} kcal={null} onSelect={() => setPicking({ kind: "local", food: f, last: recentByFood.get(f.id)?.last ?? null })} />
                  ))}
                </RowList>
              ) : (
                <Empty title="No favourites yet" body="Tap the heart when adding a food to keep it here." />
              )
            ) : myFoods.isPending ? (
              <ListSkeleton />
            ) : myFoods.data?.length || savedMeals.data?.length ? (
              <>
              {savedMeals.data?.length ? (
                <>
                  <SectionLabel>Saved meals</SectionLabel>
                  <RowList>{savedMeals.data.map(mealRow)}</RowList>
                  <SectionLabel>Foods & recipes</SectionLabel>
                </>
              ) : null}
              <RowList>
                {(myFoods.data ?? []).map((f) => (
                  <FoodRow key={f.id} name={f.name} sub={fmtSub(f.brand, f.source === "recipe" ? "Recipe" : per100Label(f))} kcal={null} onSelect={() => setPicking({ kind: "local", food: f, last: recentByFood.get(f.id)?.last ?? null })} />
                ))}
              </RowList>
              </>
            ) : (
              <Empty title="No custom foods yet" body="Create foods, recipes or your go-to meals and they'll live here." action={<Link className="font-semibold text-primary" href={`/foods/new?meal=${defaultMeal}&date=${date}`}>Create a food</Link>} />
            )}
          </div>
        </>
      ) : (
        <div className="pb-6">
          {recentMatches.length > 0 ? (
            <>
              <SectionLabel>Recent</SectionLabel>
              <RowList>
                {recentMatches.map((r) => (
                  <FoodRow key={r.key} name={r.name} sub={fmtSub(r.brand, describeAmount(r.last))} kcal={Number(r.last.kcal)} onPointerDown={() => prefetch(r.foodId)} onSelect={() => void openRecent(r)} onQuickAdd={() => quickLogRecent(r)} />
                ))}
              </RowList>
            </>
          ) : null}
          {savedMatches.length ? (
            <>
              <SectionLabel>Saved meals</SectionLabel>
              <RowList>{savedMatches.map(mealRow)}</RowList>
            </>
          ) : null}
          <SectionLabel>Foods</SectionLabel>
          {local.isPending && localMatches.length === 0 ? (
            <ListSkeleton rows={3} />
          ) : localMatches.length ? (
            <RowList>
              {localMatches.map((f) => (
                <FoodRow key={f.id} name={f.name} sub={fmtSub(f.brand, f.source === "recipe" ? "Recipe" : per100Label(f))} kcal={null} onSelect={() => setPicking({ kind: "local", food: f, last: recentByFood.get(f.id)?.last ?? null })} />
              ))}
            </RowList>
          ) : (
            <p className="px-1 text-sm text-muted-foreground">No saved foods match “{query}”.</p>
          )}
          <SectionLabel>Online</SectionLabel>
          {query.length < 3 ? (
            <p className="px-1 text-sm text-muted-foreground">Keep typing to search online databases…</p>
          ) : online.isFetching && !online.data ? (
            <ListSkeleton rows={4} />
          ) : online.isError || (online.data?.partial && onlineMatches.length === 0) ? (
            <p className="px-1 text-sm text-muted-foreground">Online search is unavailable right now{typeof navigator !== "undefined" && !navigator.onLine ? " (you're offline)" : ""}. Your saved foods still work.</p>
          ) : onlineMatches.length ? (
            <RowList>
              {onlineMatches.map((f) => (
                <FoodRow
                  key={`${f.source}:${f.sourceId}`}
                  online
                  name={f.name}
                  sub={fmtSub(f.brand, `${Math.round(f.per100.kcal)} kcal / 100 ${f.basis} · ${f.source === "usda" ? "USDA" : "Open Food Facts"}`)}
                  kcal={null}
                  onSelect={() => setPicking({ kind: "online", food: f, like: normalizedToFoodLike(f) })}
                />
              ))}
            </RowList>
          ) : (
            <Empty
              title={`No results for “${query}”`}
              body="Try a simpler term, or add it yourself."
              action={
                <div className="flex justify-center gap-4">
                  <Link className="font-semibold text-primary" href={`/foods/new?name=${encodeURIComponent(query)}&meal=${defaultMeal}&date=${date}`}>Create food</Link>
                  <Link className="font-semibold text-primary" href={`/log/quick?meal=${defaultMeal}&date=${date}`}>Quick add</Link>
                </div>
              }
            />
          )}
        </div>
      )}

      <Sheet open={picking != null} onOpenChange={(o) => !o && setPicking(null)} title="Add food">
        {picking ? (
          <ServingPicker
            key={picking.kind === "local" ? picking.food.id : `${picking.food.source}:${picking.food.sourceId}`}
            food={picking.kind === "local" ? picking.food : picking.like}
            units={units}
            mealNames={mealNames}
            initialMeal={defaultMeal}
            initial={picking.kind === "local" ? picking.last : null}
            busy={busy}
            confirmLabel={busy ? "Saving…" : "Add"}
            onConfirm={(a) => void confirm(a)}
            favorite={picking.kind === "local" ? favoriteIds.has(picking.food.id) : undefined}
            onToggleFavorite={picking.kind === "local" ? () => fav.mutate({ foodId: picking.food.id, favorite: !favoriteIds.has(picking.food.id) }) : undefined}
            secondaryAction={
              picking.kind === "local" && picking.food.user_id && picking.food.source !== "recipe" ? (
                <Link href={`/foods/${picking.food.id}`} className="grid h-13 place-items-center rounded-full bg-secondary px-5 text-sm font-semibold">Edit</Link>
              ) : undefined
            }
          />
        ) : null}
      </Sheet>
      {added > 0 ? <span className="sr-only" aria-live="polite">{added} added</span> : null}
    </main>
  );
}

function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14" />
      ))}
    </div>
  );
}

function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card px-6 py-8 text-center ring-1 ring-border/70">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
