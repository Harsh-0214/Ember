/** Pure helpers for recent/frequent foods and ranking search results. */

export interface RecentEntryLike {
  food_id: string | null;
  name: string;
  brand: string | null;
  grams: number | null;
  serving_name: string | null;
  quantity: number | null;
  meal: number;
  kcal: number;
  logged_at: string;
}

export interface RecentFood<E extends RecentEntryLike = RecentEntryLike> {
  key: string;
  foodId: string | null;
  name: string;
  brand: string | null;
  count: number;
  lastUsed: string;
  /** Most recent entry — used to prefill amount and serving. */
  last: E;
  /** Meals this food is usually eaten at, most common first. */
  meals: number[];
}

export const recentKey = (e: Pick<RecentEntryLike, "food_id" | "name" | "brand">): string => e.food_id ?? `name:${e.name.toLowerCase()}|${(e.brand ?? "").toLowerCase()}`;

export function aggregateRecents<E extends RecentEntryLike>(entries: E[]): RecentFood<E>[] {
  const map = new Map<string, RecentFood<E> & { mealCounts: Map<number, number> }>();
  for (const e of entries) {
    const key = recentKey(e);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { key, foodId: e.food_id, name: e.name, brand: e.brand, count: 1, lastUsed: e.logged_at, last: e, meals: [], mealCounts: new Map([[e.meal, 1]]) });
    } else {
      existing.count += 1;
      existing.mealCounts.set(e.meal, (existing.mealCounts.get(e.meal) ?? 0) + 1);
      if (e.logged_at > existing.lastUsed) {
        existing.lastUsed = e.logged_at;
        existing.last = e;
      }
    }
  }
  return [...map.values()].map(({ mealCounts, ...r }) => ({ ...r, meals: [...mealCounts.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m) }));
}

export const byRecent = <T extends { lastUsed: string }>(a: T, b: T): number => (a.lastUsed < b.lastUsed ? 1 : a.lastUsed > b.lastUsed ? -1 : 0);
/** Frequency with a recency tiebreak. */
export const byFrequent = <T extends { lastUsed: string; count: number }>(a: T, b: T): number => b.count - a.count || byRecent(a, b);

export const normalizeQuery = (q: string): string =>
  q
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Relevance score of a food name/brand for a query (0 = no match).
 * Prefix > whole-word > all-terms-contained; boosted by personal usage.
 */
export function matchScore(query: string, name: string, brand: string | null = null, usageCount = 0): number {
  const q = normalizeQuery(query);
  if (!q) return 0;
  const n = normalizeQuery(name);
  const b = normalizeQuery(brand ?? "");
  const hay = `${n} ${b}`;
  const terms = q.split(" ");
  if (!terms.every((t) => hay.includes(t))) return 0;
  let score = 10;
  if (n === q) score += 100;
  else if (n.startsWith(q)) score += 60;
  else if (new RegExp(`(^|\\s)${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(n)) score += 40;
  score += terms.filter((t) => new RegExp(`(^|\\s)${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(n)).length * 8;
  score -= Math.min(20, Math.max(0, n.length - q.length) / 4); // prefer shorter, more specific names
  score += Math.min(40, usageCount * 6);
  return Math.max(1, score);
}

/** Escapes a user query for a PostgREST ilike filter. */
export const ilikePattern = (q: string): string => `%${normalizeQuery(q).replace(/[%_]/g, "").replace(/\s+/g, "%")}%`;
