/**
 * Local-date helpers. A "local date" is an ISO calendar date string
 * (YYYY-MM-DD) in the user's IANA time zone. All arithmetic on local dates
 * is done in UTC to avoid DST surprises.
 */
import { TZDate } from "@date-fns/tz";

export type LocalDate = string; // YYYY-MM-DD

export const DEFAULT_TIMEZONE = "America/Toronto";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isLocalDate = (s: string): s is LocalDate => DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    fmtCache.set(tz, f);
  }
  return f;
}

/** The local calendar date of an instant in a time zone. */
export function localDateOf(instant: Date | string | number, tz: string = DEFAULT_TIMEZONE): LocalDate {
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) throw new RangeError(`Invalid instant: ${String(instant)}`);
  const parts = formatter(isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export const todayIn = (tz: string = DEFAULT_TIMEZONE, now: Date = new Date()): LocalDate => localDateOf(now, tz);

const toUtc = (d: LocalDate): Date => new Date(`${d}T00:00:00Z`);
const fromUtc = (d: Date): LocalDate => d.toISOString().slice(0, 10);

export function addDays(d: LocalDate, n: number): LocalDate {
  const t = toUtc(d);
  t.setUTCDate(t.getUTCDate() + n);
  return fromUtc(t);
}

/** Whole days from a to b (b − a). */
export const daysBetween = (a: LocalDate, b: LocalDate): number => Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);

/** Inclusive list of dates from start to end. */
export function dateRange(start: LocalDate, end: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  const n = daysBetween(start, end);
  for (let i = 0; i <= n; i++) out.push(addDays(start, i));
  return out;
}

/** 0 = Sunday … 6 = Saturday. */
export const weekday = (d: LocalDate): number => toUtc(d).getUTCDay();

/** Most recent date on/before d that falls on `weekStartsOn`. */
export function startOfWeek(d: LocalDate, weekStartsOn = 1): LocalDate {
  const diff = (weekday(d) - weekStartsOn + 7) % 7;
  return addDays(d, -diff);
}

/** UTC instants bounding a local day: [start, end). */
export function localDayBounds(d: LocalDate, tz: string = DEFAULT_TIMEZONE): { start: Date; end: Date } {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  const start = new TZDate(y, m - 1, day, 0, 0, 0, tz);
  const next = addDays(d, 1).split("-").map(Number) as [number, number, number];
  const end = new TZDate(next[0], next[1] - 1, next[2], 0, 0, 0, tz);
  return { start: new Date(start.getTime()), end: new Date(end.getTime()) };
}

export function ageOn(birthDate: LocalDate, on: LocalDate): number {
  const [by, bm, bd] = birthDate.split("-").map(Number) as [number, number, number];
  const [y, m, d] = on.split("-").map(Number) as [number, number, number];
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const weekdayName = (i: number): string => WEEKDAYS[((i % 7) + 7) % 7] ?? "";

/** Friendly label: Today, Yesterday, Tomorrow, or "Mon, Nov 3". */
export function friendlyDate(d: LocalDate, today: LocalDate): string {
  const diff = daysBetween(today, d);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  const dt = toUtc(d);
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...(dt.getUTCFullYear() !== toUtc(today).getUTCFullYear() ? { year: "numeric" } : {}),
  });
}

export const shortDate = (d: LocalDate): string =>
  toUtc(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "5 min ago", "3 h ago", "2 d ago". */
export function timeAgo(instant: Date | string, now: Date = new Date()): string {
  const t = instant instanceof Date ? instant : new Date(instant);
  const s = Math.max(0, Math.round((now.getTime() - t.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
