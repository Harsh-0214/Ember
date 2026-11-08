"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { addDays, isLocalDate } from "@/lib/dates";
import { useToday } from "@/lib/data/hooks";

/** The diary date from ?date=YYYY-MM-DD (defaults to today in the user's time zone). */
export function useSelectedDate(): { date: string; today: string; setDate: (d: string) => void; shift: (n: number) => void } {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const today = useToday();
  const raw = params.get("date");
  const date = raw && isLocalDate(raw) ? raw : today;
  const setDate = useCallback(
    (d: string) => {
      const sp = new URLSearchParams(params.toString());
      if (d === today) sp.delete("date");
      else sp.set("date", d);
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router, today],
  );
  const shift = useCallback((n: number) => setDate(addDays(date, n)), [date, setDate]);
  return { date, today, setDate, shift };
}
