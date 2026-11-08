import { ApiError, ok, withAuth } from "@/lib/api/server";
import { barcodeVariants } from "@/lib/foods/barcode";
import { upsertSharedFood } from "@/lib/foods/cache";
import { fetchOffProduct } from "@/lib/foods/external";
import { hasServiceRole } from "@/lib/env.server";

/**
 * Barcode lookup: the user's own foods and the shared cache first (instant,
 * works for products added manually), then Open Food Facts.
 */
export const GET = withAuth<{ code: string }>(
  async (_req, { supabase }, params) => {
    const variants = barcodeVariants(String(params.code ?? ""));
    if (!variants.length) throw new ApiError(400, "validation", "That doesn't look like a barcode.");
    const { data: local } = await supabase.from("foods").select("*, food_servings(*)").in("barcode", variants).order("user_id", { nullsFirst: false }).limit(1);
    if (local?.length) return ok({ food: local[0], source: "cache" });
    let product = null;
    for (const v of variants.filter((c) => c.length >= 12).slice(0, 2)) {
      try {
        product = await fetchOffProduct(v);
      } catch (e) {
        throw new ApiError(502, "upstream", e instanceof Error ? e.message : "Open Food Facts is unavailable");
      }
      if (product) break;
    }
    if (!product) throw new ApiError(404, "not_found", "Product not found.");
    if (!hasServiceRole()) return ok({ food: null, normalized: product, source: "off" });
    const food = await upsertSharedFood({ ...product, barcode: product.barcode ?? variants[0]! });
    return ok({ food, source: "off" });
  },
  { bucket: "barcode", limit: 60, windowSec: 60 },
);
