import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets, the service worker, manifest, icons and the token-authenticated ingest API.
    "/((?!_next/static|_next/image|serwist|favicon.ico|manifest.webmanifest|icons/|apple-touch-icon|robots.txt|api/ingest|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|js|map)$).*)",
  ],
};
