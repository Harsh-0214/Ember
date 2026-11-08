import { z } from "zod";
import { ok, parseQuery, withAuth } from "@/lib/api/server";
import { mergeOnline, searchOff, searchUsda } from "@/lib/foods/external";

const querySchema = z.object({ q: z.string().trim().min(2).max(80) });

/** Online food search (USDA + Open Food Facts), proxied server-side. */
export const GET = withAuth(
  async (req) => {
    const { q } = parseQuery(req, querySchema);
    const [usda, off] = await Promise.allSettled([searchUsda(q), searchOff(q)]);
    const results = mergeOnline(usda.status === "fulfilled" ? usda.value : [], off.status === "fulfilled" ? off.value : []);
    const failed = [usda, off].filter((r) => r.status === "rejected").length;
    return ok({ results, partial: failed > 0 });
  },
  { bucket: "food-search", limit: 40, windowSec: 60 },
);
