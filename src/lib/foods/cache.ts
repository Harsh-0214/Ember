import "server-only";
import type { NormalizedFood } from "@/lib/schemas/food";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hasServiceRole } from "@/lib/env.server";
import { ApiError } from "@/lib/api/errors";
import type { Tables } from "@/types/database";

export type FoodRow = Tables<"foods">;
export type ServingRow = Tables<"food_servings">;
export type FoodWithServings = FoodRow & { food_servings: ServingRow[] };

/**
 * Upserts an external food into the shared cache (user_id = null) and replaces
 * its servings. Uses the service role: shared rows aren't writable by users.
 */
export async function upsertSharedFood(f: NormalizedFood): Promise<FoodWithServings> {
  if (!hasServiceRole()) throw new ApiError(503, "not_configured", "SUPABASE_SERVICE_ROLE_KEY is required to cache foods.");
  const admin = getSupabaseAdmin();
  const { data: food, error } = await admin
    .from("foods")
    .upsert(
      {
        user_id: null,
        source: f.source,
        source_id: f.sourceId,
        name: f.name,
        brand: f.brand,
        barcode: f.barcode,
        basis: f.basis,
        kcal: f.per100.kcal,
        protein_g: f.per100.protein_g,
        carbs_g: f.per100.carbs_g,
        fat_g: f.per100.fat_g,
        fiber_g: f.per100.fiber_g,
        sugar_g: f.per100.sugar_g,
        sat_fat_g: f.per100.sat_fat_g,
        sodium_mg: f.per100.sodium_mg,
      },
      { onConflict: "source,source_id" },
    )
    .select("*")
    .single();
  if (error || !food) throw new ApiError(500, "db_error", "Couldn't save food", error?.message);
  await admin.from("food_servings").delete().eq("food_id", food.id);
  let servings: ServingRow[] = [];
  if (f.servings.length) {
    const { data, error: sErr } = await admin
      .from("food_servings")
      .insert(f.servings.map((s, i) => ({ food_id: food.id, user_id: null, name: s.name, grams: s.grams, is_default: i === 0, position: i })))
      .select("*");
    if (sErr) throw new ApiError(500, "db_error", "Couldn't save servings", sErr.message);
    servings = data ?? [];
  }
  return { ...food, food_servings: servings };
}

/** Looks up a cached shared food by source id. */
export async function findSharedFood(source: string, sourceId: string): Promise<FoodWithServings | null> {
  if (!hasServiceRole()) return null;
  const { data } = await getSupabaseAdmin().from("foods").select("*, food_servings(*)").eq("source", source).eq("source_id", sourceId).is("user_id", null).maybeSingle();
  return (data as FoodWithServings | null) ?? null;
}
