/** Coerces OFF/USDA-style values ("12,5", "12.5 g", 12.5) to a finite number or null. */
export function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const m = v.replace(",", ".").match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export const clampNum = (n: number | null, lo: number, hi: number): number | null => (n == null ? null : Math.min(hi, Math.max(lo, n)));
export const r1 = (n: number): number => Math.round(n * 10) / 10;
export const r2 = (n: number): number => Math.round(n * 100) / 100;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
export const asRecord = (v: unknown): Record<string, unknown> => (isRecord(v) ? v : {});
export const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);

/** Title-cases ALL CAPS names that USDA branded foods often have. */
export function tidyName(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length > 3 && t === t.toUpperCase()) {
    return t.toLowerCase().replace(/(^|[\s,(/-])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
  }
  return t;
}
