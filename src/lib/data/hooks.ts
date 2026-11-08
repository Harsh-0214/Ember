"use client";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { api } from "@/lib/api/client";
import { send } from "@/lib/sync";
import { addDays, DEFAULT_TIMEZONE, todayIn } from "@/lib/dates";
import { aggregateRecents, ilikePattern } from "@/lib/foods/recents";
import type { EntryInput, EntryPatch } from "@/lib/schemas/diary";
import type { NormalizedFood } from "@/lib/schemas/food";
import { goalForDate } from "./goal";
import { qk } from "./keys";
import type { BodyMetric, DailySummary, FoodEntry, FoodWithServings, Goal, HealthSample, Profile, WaterEntry, Workout } from "./types";

const sb = () => getSupabaseBrowser();

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ---------------------------------------------------------------- profile/goals
export function useProfile() {
  return useQuery({
    queryKey: qk.profile,
    queryFn: async () => unwrap(await sb().from("profiles").select("*").maybeSingle()) as Profile | null,
    staleTime: 5 * 60_000,
  });
}

export function useGoals() {
  return useQuery({
    queryKey: qk.goals,
    queryFn: async () => unwrap(await sb().from("goals").select("*").order("effective_from", { ascending: false })) as Goal[],
    staleTime: 5 * 60_000,
  });
}

export function useGoalFor(date: string): Goal | null {
  const { data } = useGoals();
  return useMemo(() => goalForDate(data, date), [data, date]);
}

export function useTimezone(): string {
  const { data } = useProfile();
  if (data?.timezone) return data.timezone;
  if (typeof Intl !== "undefined") return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  return DEFAULT_TIMEZONE;
}

export function useToday(): string {
  const tz = useTimezone();
  return todayIn(tz);
}

export function useUnits(): "metric" | "imperial" {
  const { data } = useProfile();
  return data?.units === "imperial" ? "imperial" : "metric";
}

// ---------------------------------------------------------------- diary reads
export function useDiary(date: string) {
  return useQuery({
    queryKey: qk.diary(date),
    queryFn: async () => unwrap(await sb().from("food_entries").select("*").eq("date", date).order("logged_at")) as FoodEntry[],
  });
}

export function useWater(date: string) {
  return useQuery({
    queryKey: qk.water(date),
    queryFn: async () => unwrap(await sb().from("water_entries").select("*").eq("date", date).order("logged_at")) as WaterEntry[],
  });
}

export function useBodyDay(date: string) {
  return useQuery({
    queryKey: qk.bodyDay(date),
    queryFn: async () => unwrap(await sb().from("body_metrics").select("*").eq("date", date).order("measured_at")) as BodyMetric[],
  });
}

/** All weigh-ins (date + weight) for trend calculations. */
export function useWeights() {
  return useQuery({
    queryKey: qk.weights,
    queryFn: async () => {
      const rows = unwrap(
        await sb().from("body_metrics").select("id, date, weight_kg, measured_at, source").not("weight_kg", "is", null).order("date", { ascending: true }).limit(5000),
      ) as Pick<BodyMetric, "id" | "date" | "weight_kg" | "measured_at" | "source">[];
      return rows.filter((r) => r.weight_kg != null).map((r) => ({ id: r.id, date: r.date, weightKg: Number(r.weight_kg), measuredAt: r.measured_at, source: r.source }));
    },
    staleTime: 60_000,
  });
}

export function useSummary(date: string) {
  return useQuery({
    queryKey: qk.summary(date),
    queryFn: async () => unwrap(await sb().from("daily_summaries").select("*").eq("date", date).maybeSingle()) as DailySummary | null,
  });
}

export function useSummaries(from: string, to: string) {
  return useQuery({
    queryKey: qk.summaries(from, to),
    queryFn: async () => unwrap(await sb().from("daily_summaries").select("*").gte("date", from).lte("date", to).order("date")) as DailySummary[],
  });
}

export function useWorkouts(date: string) {
  return useQuery({
    queryKey: qk.workouts(date),
    queryFn: async () => unwrap(await sb().from("workouts").select("*").eq("date", date).order("started_at", { nullsFirst: false })) as Workout[],
  });
}

export function useHealth(date: string) {
  return useQuery({
    queryKey: qk.health(date),
    queryFn: async () => unwrap(await sb().from("health_samples").select("*").eq("date", date)) as HealthSample[],
  });
}

export function useLastSync() {
  return useQuery({
    queryKey: qk.lastSync,
    queryFn: async () =>
      unwrap(await sb().from("sync_log").select("received_at, status").eq("status", "ok").order("received_at", { ascending: false }).limit(1).maybeSingle()) as {
        received_at: string;
        status: string;
      } | null,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------- foods
const RECENT_COLS = "id, food_id, name, brand, grams, serving_name, quantity, meal, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sat_fat_g, sodium_mg, logged_at, source";
export type RecentEntry = Pick<FoodEntry, "id" | "food_id" | "name" | "brand" | "grams" | "serving_name" | "quantity" | "meal" | "kcal" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g" | "sugar_g" | "sat_fat_g" | "sodium_mg" | "logged_at" | "source">;

export function useRecents() {
  return useQuery({
    queryKey: qk.recents,
    queryFn: async () => {
      const since = addDays(todayIn(DEFAULT_TIMEZONE), -120);
      const rows = unwrap(await sb().from("food_entries").select(RECENT_COLS).gte("date", since).order("logged_at", { ascending: false }).limit(600)) as RecentEntry[];
      return aggregateRecents(rows);
    },
    staleTime: 60_000,
  });
}

export function useFavorites() {
  return useQuery({
    queryKey: qk.favorites,
    queryFn: async () => {
      const rows = unwrap(await sb().from("food_favorites").select("food_id, created_at, foods(*, food_servings(*))").order("created_at", { ascending: false })) as unknown as {
        food_id: string;
        foods: FoodWithServings | null;
      }[];
      return rows.map((r) => r.foods).filter((f): f is FoodWithServings => f != null);
    },
    staleTime: 5 * 60_000,
  });
}

export function useMyFoods() {
  return useQuery({
    queryKey: qk.myFoods,
    queryFn: async () => unwrap(await sb().from("foods").select("*, food_servings(*)").not("user_id", "is", null).order("updated_at", { ascending: false }).limit(500)) as FoodWithServings[],
    staleTime: 60_000,
  });
}

export async function fetchFood(qc: QueryClient, id: string): Promise<FoodWithServings | null> {
  return qc.fetchQuery({
    queryKey: qk.food(id),
    queryFn: async () => unwrap(await sb().from("foods").select("*, food_servings(*)").eq("id", id).maybeSingle()) as FoodWithServings | null,
    staleTime: 10 * 60_000,
  });
}

export function useLocalFoodSearch(q: string) {
  const enabled = q.trim().length >= 2;
  return useQuery({
    queryKey: qk.localSearch(q.trim().toLowerCase()),
    enabled,
    queryFn: async () => {
      const pattern = ilikePattern(q);
      return unwrap(await sb().from("foods").select("*, food_servings(*)").or(`name.ilike.${pattern},brand.ilike.${pattern}`).limit(40)) as FoodWithServings[];
    },
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useOnlineFoodSearch(q: string) {
  const enabled = q.trim().length >= 3;
  return useQuery({
    queryKey: qk.onlineSearch(q.trim().toLowerCase()),
    enabled,
    queryFn: () => api.get<{ results: NormalizedFood[]; partial: boolean }>(`/api/foods/search?q=${encodeURIComponent(q.trim())}`),
    staleTime: 10 * 60_000,
    retry: false,
    networkMode: "online",
  });
}

export async function cacheOnlineFood(qc: QueryClient, f: NormalizedFood): Promise<FoodWithServings> {
  const { food } = await api.post<{ food: FoodWithServings }>("/api/foods/cache", { source: f.source, sourceId: f.sourceId });
  qc.setQueryData(qk.food(food.id), food);
  return food;
}

// ---------------------------------------------------------------- mutations
function optimisticList<T extends { id: string }>(qc: QueryClient, key: readonly unknown[], update: (prev: T[]) => T[]) {
  const prev = qc.getQueryData<T[]>(key);
  qc.setQueryData<T[]>(key, update(prev ?? []));
  return prev;
}

export function entryRowFromInput(e: EntryInput, userId = ""): FoodEntry {
  const now = new Date().toISOString();
  return {
    ...e,
    user_id: userId,
    external_id: null,
    logged_at: e.logged_at ?? now,
    created_at: now,
    updated_at: now,
  };
}

export function useAddEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entries: EntryInput[]) => send<{ entries: FoodEntry[] }>({ method: "POST", path: "/api/entries", body: { entries }, label: entries.length === 1 ? `Add ${entries[0]!.name}` : `Add ${entries.length} foods` }),
    onMutate: async (entries) => {
      const dates = [...new Set(entries.map((e) => e.date))];
      await Promise.all(dates.map((d) => qc.cancelQueries({ queryKey: qk.diary(d) })));
      const snapshots = dates.map((d) => [d, optimisticList<FoodEntry>(qc, qk.diary(d), (prev) => [...prev.filter((p) => !entries.some((e) => e.id === p.id)), ...entries.filter((e) => e.date === d).map((e) => entryRowFromInput(e))])] as const);
      return { snapshots };
    },
    onError: (err, _v, ctx) => {
      ctx?.snapshots.forEach(([d, prev]) => qc.setQueryData(qk.diary(d), prev));
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    },
    onSettled: (_d, _e, entries) => {
      [...new Set(entries.map((e) => e.date))].forEach((d) => {
        void qc.invalidateQueries({ queryKey: qk.diary(d) });
        void qc.invalidateQueries({ queryKey: qk.summary(d) });
      });
      void qc.invalidateQueries({ queryKey: qk.recents });
    },
  });
}

export function useUpdateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; date: string; patch: EntryPatch }) => send<{ entry: FoodEntry }>({ method: "PATCH", path: `/api/entries/${id}`, body: patch, label: "Update entry" }),
    onMutate: async ({ id, date, patch }) => {
      await qc.cancelQueries({ queryKey: qk.diary(date) });
      const prev = optimisticList<FoodEntry>(qc, qk.diary(date), (list) => list.map((e) => (e.id === id ? { ...e, ...patch } as FoodEntry : e)).filter((e) => e.date === date));
      if (patch.date && patch.date !== date) {
        const moved = prev?.find((e) => e.id === id);
        if (moved) optimisticList<FoodEntry>(qc, qk.diary(patch.date), (list) => [...list, { ...moved, ...patch } as FoodEntry]);
      }
      return { prev, date };
    },
    onError: (err, _v, ctx) => {
      if (ctx) qc.setQueryData(qk.diary(ctx.date), ctx.prev);
      toast.error(err instanceof Error ? err.message : "Couldn't update");
    },
    onSettled: (_d, _e, v) => {
      void qc.invalidateQueries({ queryKey: qk.diary(v.date) });
      if (v.patch.date) void qc.invalidateQueries({ queryKey: qk.diary(v.patch.date) });
      void qc.invalidateQueries({ queryKey: qk.summary(v.date) });
    },
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  const add = useAddEntries();
  const m = useMutation({
    mutationFn: (e: FoodEntry) => send<{ ok: true }>({ method: "DELETE", path: `/api/entries/${e.id}`, label: `Delete ${e.name}` }),
    onMutate: async (e) => {
      await qc.cancelQueries({ queryKey: qk.diary(e.date) });
      const prev = optimisticList<FoodEntry>(qc, qk.diary(e.date), (list) => list.filter((x) => x.id !== e.id));
      return { prev };
    },
    onError: (err, e, ctx) => {
      qc.setQueryData(qk.diary(e.date), ctx?.prev);
      toast.error(err instanceof Error ? err.message : "Couldn't delete");
    },
    onSettled: (_d, _e, e) => {
      void qc.invalidateQueries({ queryKey: qk.diary(e.date) });
      void qc.invalidateQueries({ queryKey: qk.summary(e.date) });
    },
  });
  /** Deletes with an Undo toast (re-creates the same row id). */
  const removeWithUndo = (e: FoodEntry) => {
    m.mutate(e);
    toast(`Removed ${e.name}`, {
      action: {
        label: "Undo",
        onClick: () =>
          add.mutate([
            {
              id: e.id, date: e.date, meal: e.meal, food_id: e.food_id, name: e.name, brand: e.brand, grams: e.grams, serving_name: e.serving_name, quantity: e.quantity,
              kcal: e.kcal, protein_g: e.protein_g, carbs_g: e.carbs_g, fat_g: e.fat_g, fiber_g: e.fiber_g, sugar_g: e.sugar_g, sat_fat_g: e.sat_fat_g, sodium_mg: e.sodium_mg,
              source: e.source as EntryInput["source"], logged_at: e.logged_at,
            },
          ]),
      },
    });
  };
  return { ...m, removeWithUndo };
}

export function useAddWater() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (w: { id: string; date: string; ml: number }) => send({ method: "POST", path: "/api/water", body: w, label: `Add ${w.ml} ml water` }),
    onMutate: async (w) => {
      await qc.cancelQueries({ queryKey: qk.water(w.date) });
      const prev = optimisticList<WaterEntry>(qc, qk.water(w.date), (l) => [...l, { ...w, user_id: "", source: "manual", external_id: null, logged_at: new Date().toISOString() }]);
      return { prev };
    },
    onError: (err, w, ctx) => {
      qc.setQueryData(qk.water(w.date), ctx?.prev);
      toast.error(err instanceof Error ? err.message : "Couldn't add water");
    },
    onSettled: (_d, _e, w) => void qc.invalidateQueries({ queryKey: qk.water(w.date) }),
  });
}

export function useDeleteWater() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (w: WaterEntry) => send({ method: "DELETE", path: `/api/water/${w.id}`, label: "Remove water" }),
    onMutate: async (w) => {
      await qc.cancelQueries({ queryKey: qk.water(w.date) });
      const prev = optimisticList<WaterEntry>(qc, qk.water(w.date), (l) => l.filter((x) => x.id !== w.id));
      return { prev };
    },
    onError: (_err, w, ctx) => qc.setQueryData(qk.water(w.date), ctx?.prev),
    onSettled: (_d, _e, w) => void qc.invalidateQueries({ queryKey: qk.water(w.date) }),
  });
}

export function useSaveBodyMetric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Record<string, unknown> & { id: string; date: string }) => send<{ metric: BodyMetric }>({ method: "POST", path: "/api/body", body: b, label: "Save body metrics" }),
    onMutate: async (b) => {
      await qc.cancelQueries({ queryKey: qk.bodyDay(b.date) });
      const prev = qc.getQueryData<BodyMetric[]>(qk.bodyDay(b.date));
      const row = { measured_at: new Date().toISOString(), source: "manual", ...b } as unknown as BodyMetric;
      qc.setQueryData<BodyMetric[]>(qk.bodyDay(b.date), [...(prev ?? []).filter((x) => x.id !== b.id), row]);
      return { prev };
    },
    onError: (err, b, ctx) => {
      qc.setQueryData(qk.bodyDay(b.date), ctx?.prev);
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    },
    onSettled: (_d, _e, b) => {
      void qc.invalidateQueries({ queryKey: qk.bodyDay(b.date) });
      void qc.invalidateQueries({ queryKey: ["body"] });
      void qc.invalidateQueries({ queryKey: qk.summary(b.date) });
    },
  });
}

export function useDeleteBodyMetric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: BodyMetric) => send({ method: "DELETE", path: `/api/body/${b.id}`, label: "Delete weigh-in" }),
    onSettled: (_d, _e, b) => {
      void qc.invalidateQueries({ queryKey: ["body"] });
      void qc.invalidateQueries({ queryKey: qk.summary(b.date) });
    },
  });
}

export function useDayFlags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (f: { date: string; is_complete?: boolean; is_fasted?: boolean }) => send({ method: "POST", path: "/api/day-flags", body: f, label: "Update day" }),
    onMutate: async (f) => {
      const prev = qc.getQueryData<DailySummary | null>(qk.summary(f.date));
      qc.setQueryData(qk.summary(f.date), { ...(prev ?? { date: f.date }), ...f });
      return { prev };
    },
    onError: (_e, f, ctx) => qc.setQueryData(qk.summary(f.date), ctx?.prev),
    onSettled: (_d, _e, f) => void qc.invalidateQueries({ queryKey: qk.summary(f.date) }),
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ foodId, favorite }: { foodId: string; favorite: boolean }) => send({ method: "POST", path: `/api/foods/${foodId}/favorite`, body: { favorite } }),
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.favorites }),
  });
}
