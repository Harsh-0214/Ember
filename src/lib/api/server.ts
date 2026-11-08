import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { ApiError, type ApiErrorBody } from "./errors";
import { rateLimit } from "./rate-limit";

export { ApiError };

export interface AuthedContext {
  supabase: SupabaseClient<Database>;
  userId: string;
}

export function errorResponse(e: unknown): NextResponse<ApiErrorBody> {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status, headers: { "Cache-Control": "no-store" } });
  }
  console.error("[api] unexpected error", e);
  return NextResponse.json({ error: { code: "internal", message: "Something went wrong" } }, { status: 500, headers: { "Cache-Control": "no-store" } });
}

/** Throws a 400 ApiError for a failed Supabase/PostgREST call. */
export function dbError(error: { message: string; code?: string } | null): void {
  if (!error) return;
  if (error.code === "23505") throw new ApiError(409, "conflict", "That already exists.");
  if (error.code === "23514" || error.code === "22P02" || error.code === "23502") throw new ApiError(400, "invalid", "Some values are out of range.", error.message);
  if (error.code === "42501") throw new ApiError(403, "forbidden", "Not allowed.");
  throw new ApiError(500, "db_error", "Database error", error.message);
}

const MAX_BODY_BYTES = 512 * 1024;

export async function parseBody<S extends z.ZodType>(req: NextRequest | Request, schema: S, maxBytes = MAX_BODY_BYTES): Promise<z.infer<S>> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > maxBytes) throw new ApiError(413, "too_large", "Request body is too large.");
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > maxBytes) throw new ApiError(413, "too_large", "Request body is too large.");
    raw = text ? JSON.parse(text) : {};
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, "bad_json", "Body must be valid JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(400, "validation", parsed.error.issues[0]?.message ?? "Invalid input", z.flattenError(parsed.error));
  }
  return parsed.data;
}

export function parseQuery<S extends z.ZodType>(req: NextRequest, schema: S): z.infer<S> {
  const obj = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = schema.safeParse(obj);
  if (!parsed.success) throw new ApiError(400, "validation", parsed.error.issues[0]?.message ?? "Invalid query");
  return parsed.data;
}

type RouteCtx<P> = { params: Promise<P> };

/**
 * Wraps a route handler: requires a signed-in user (cookie session),
 * applies a per-user rate limit, and converts errors to JSON.
 */
export function withAuth<P = Record<string, never>>(
  handler: (req: NextRequest, ctx: AuthedContext, params: P) => Promise<Response>,
  opts: { limit?: number; windowSec?: number; bucket?: string } = {},
) {
  return async (req: NextRequest, routeCtx: RouteCtx<P>): Promise<Response> => {
    try {
      if (!isSupabaseConfigured()) throw new ApiError(503, "not_configured", "Supabase is not configured.");
      const supabase = await getSupabaseServer();
      const { data } = await supabase.auth.getClaims();
      const userId = data?.claims?.sub;
      if (!userId) throw new ApiError(401, "unauthorized", "Please sign in again.");
      const ok = await rateLimit(`${opts.bucket ?? "api"}:${userId}`, opts.limit ?? 240, opts.windowSec ?? 60);
      if (!ok) throw new ApiError(429, "rate_limited", "Too many requests — slow down a little.");
      const params = (await routeCtx?.params) ?? ({} as P);
      return await handler(req, { supabase, userId }, params);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export const ok = <T>(data: T, status = 200): NextResponse<T> => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export const idParamSchema = z.object({ id: z.uuid() });
export function parseId(params: { id?: string }): string {
  const p = idParamSchema.safeParse(params);
  if (!p.success) throw new ApiError(400, "validation", "Invalid id");
  return p.data.id;
}
