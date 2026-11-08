import "server-only";
import { hasServiceRole } from "@/lib/env.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** In-memory fallback (per serverless instance). */
const memory = new Map<string, { windowStart: number; count: number }>();

function memoryHit(key: string, limit: number, windowSec: number): boolean {
  const now = Date.now();
  const w = Math.floor(now / (windowSec * 1000));
  const e = memory.get(key);
  if (!e || e.windowStart !== w) {
    memory.set(key, { windowStart: w, count: 1 });
    if (memory.size > 5000) memory.clear();
    return true;
  }
  e.count += 1;
  return e.count <= limit;
}

/**
 * Fixed-window rate limit. Uses the Postgres `rate_limit_hit` RPC (shared
 * across serverless instances) when the service role key is available, and
 * falls back to memory otherwise. Fails open on database errors.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  if (!memoryHit(key, limit, windowSec)) return false;
  if (!hasServiceRole()) return true;
  try {
    const { data, error } = await getSupabaseAdmin().rpc("rate_limit_hit", { p_key: key, p_limit: limit, p_window_seconds: windowSec });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

/** Simple token bucket for outbound API politeness (Open Food Facts asks for limits). */
export class TokenBucket {
  private tokens: number;
  private last = Date.now();
  constructor(private capacity: number, private refillPerMinute: number) {
    this.tokens = capacity;
  }
  take(): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 60_000) * this.refillPerMinute);
    this.last = now;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}
