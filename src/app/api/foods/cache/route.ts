import { ApiError, ok, parseBody, withAuth } from "@/lib/api/server";
import { cacheFoodInputSchema } from "@/lib/schemas/food";
import { fetchOffProduct, fetchUsdaFood } from "@/lib/foods/external";
import { findSharedFood, upsertSharedFood } from "@/lib/foods/cache";

/**
 * Caches an online food in the shared `foods` table. The server re-fetches the
 * food from the source by id (never trusting client-supplied nutrition data).
 */
export const POST = withAuth(
  async (req) => {
    const { source, sourceId } = await parseBody(req, cacheFoodInputSchema);
    const cached = await findSharedFood(source, sourceId);
    if (cached && Date.now() - Date.parse(cached.updated_at) < 1000 * 60 * 60 * 24 * 30) return ok({ food: cached });
    let normalized;
    try {
      normalized = source === "off" ? await fetchOffProduct(sourceId) : await fetchUsdaFood(sourceId);
    } catch (e) {
      if (cached) return ok({ food: cached });
      throw new ApiError(502, "upstream", e instanceof Error ? e.message : "Food database unavailable");
    }
    if (!normalized) {
      if (cached) return ok({ food: cached });
      throw new ApiError(404, "not_found", "That food couldn't be found.");
    }
    const food = await upsertSharedFood(normalized);
    return ok({ food });
  },
  { bucket: "food-cache", limit: 60, windowSec: 60 },
);
