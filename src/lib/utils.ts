import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** RFC 4122 v4 UUID (client-generated ids make offline replays idempotent). */
export function uuid(): string {
  const c: Crypto = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const fmtInt = (n: number | null | undefined): string => (n == null || !Number.isFinite(n) ? "—" : Math.round(n).toLocaleString("en-US"));
export const fmt1 = (n: number | null | undefined): string => (n == null || !Number.isFinite(n) ? "—" : (Math.round(n * 10) / 10).toString());
export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Light haptic tap where supported (Android); no-op on iOS Safari. */
export function haptic(ms = 8): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}
