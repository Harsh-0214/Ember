import "server-only";
import { serverEnv } from "@/lib/env.server";
import { TokenBucket } from "@/lib/api/rate-limit";
import { normalizeOffProduct, normalizeOffSearch, OFF_FIELDS } from "@/lib/parsers/off";
import { normalizeUsdaFood, normalizeUsdaSearch } from "@/lib/parsers/usda";
import type { NormalizedFood } from "@/lib/schemas/food";

/** Open Food Facts asks API clients to identify themselves. */
export const OFF_USER_AGENT = "Ember/1.0 (personal nutrition PWA; https://github.com/harsh-0214/ember)";
const OFF_BASE = "https://world.openfoodfacts.org";
const USDA_BASE = "https://api.nal.usda.gov/fdc/v1";

// OFF published limits: 10 searches/min and 100 product reads/min per client.
const offSearchBucket = new TokenBucket(10, 10);
const offProductBucket = new TokenBucket(100, 100);
const usdaBucket = new TokenBucket(30, 30); // USDA allows 1000/h per key

/** Small TTL cache so repeat searches don't hit upstream APIs. */
class TtlCache<V> {
  private map = new Map<string, { v: V; exp: number }>();
  constructor(private ttlMs: number, private max = 300) {}
  get(k: string): V | undefined {
    const e = this.map.get(k);
    if (!e) return undefined;
    if (e.exp < Date.now()) {
      this.map.delete(k);
      return undefined;
    }
    return e.v;
  }
  set(k: string, v: V) {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value as string);
    this.map.set(k, { v, exp: Date.now() + this.ttlMs });
  }
}
const searchCache = new TtlCache<NormalizedFood[]>(10 * 60_000);

async function getJson(url: string, init: RequestInit = {}, timeoutMs = 6000): Promise<unknown> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Upstream ${new URL(url).host} responded ${res.status}`);
  return res.json();
}

export async function searchOff(query: string, pageSize = 20): Promise<NormalizedFood[]> {
  const key = `off:${query.toLowerCase()}`;
  const hit = searchCache.get(key);
  if (hit) return hit;
  if (!offSearchBucket.take()) return [];
  const url = `${OFF_BASE}/cgi/search.pl?${new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: String(pageSize),
    fields: OFF_FIELDS,
  })}`;
  const raw = await getJson(url, { headers: { "User-Agent": OFF_USER_AGENT, Accept: "application/json" } });
  const res = normalizeOffSearch(raw);
  searchCache.set(key, res);
  return res;
}

export async function fetchOffProduct(code: string): Promise<NormalizedFood | null> {
  if (!/^\d{6,14}$/.test(code)) return null;
  if (!offProductBucket.take()) throw new Error("Open Food Facts rate limit reached — try again in a minute.");
  const raw = (await getJson(`${OFF_BASE}/api/v2/product/${code}.json?fields=${OFF_FIELDS}`, {
    headers: { "User-Agent": OFF_USER_AGENT, Accept: "application/json" },
  })) as { status?: number; product?: unknown } | null;
  if (!raw || raw.status === 0 || !raw.product) return null;
  return normalizeOffProduct(raw.product);
}

export async function searchUsda(query: string, pageSize = 20): Promise<NormalizedFood[]> {
  if (!serverEnv.usdaApiKey) return [];
  const key = `usda:${query.toLowerCase()}`;
  const hit = searchCache.get(key);
  if (hit) return hit;
  if (!usdaBucket.take()) return [];
  const raw = await getJson(`${USDA_BASE}/foods/search?api_key=${encodeURIComponent(serverEnv.usdaApiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, pageSize, dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)", "Branded"] }),
  });
  const res = normalizeUsdaSearch(raw);
  searchCache.set(key, res);
  return res;
}

export async function fetchUsdaFood(fdcId: string): Promise<NormalizedFood | null> {
  if (!serverEnv.usdaApiKey || !/^\d{1,12}$/.test(fdcId)) return null;
  const raw = await getJson(`${USDA_BASE}/food/${fdcId}?api_key=${encodeURIComponent(serverEnv.usdaApiKey)}`);
  return raw ? normalizeUsdaFood(raw) : null;
}

/** Interleaves results so generic USDA foods and branded OFF products both surface. */
export function mergeOnline(usda: NormalizedFood[], off: NormalizedFood[], limit = 30): NormalizedFood[] {
  const out: NormalizedFood[] = [];
  const seen = new Set<string>();
  const add = (f: NormalizedFood) => {
    const k = `${f.name.toLowerCase()}|${(f.brand ?? "").toLowerCase()}|${Math.round(f.per100.kcal)}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(f);
  };
  const max = Math.max(usda.length, off.length);
  for (let i = 0; i < max && out.length < limit; i++) {
    if (usda[i]) add(usda[i]!);
    if (off[i]) add(off[i]!);
  }
  return out;
}
