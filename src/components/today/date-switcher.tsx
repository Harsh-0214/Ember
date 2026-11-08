"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { friendlyDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";

export function DateSwitcher({ date, today, onChange, onShift, right }: { date: string; today: string; onChange: (d: string) => void; onShift: (n: number) => void; right?: React.ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="sticky top-0 z-30 -mx-4 bg-background/90 px-2 pt-safe backdrop-blur-xl">
      <div className="flex h-14 items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Previous day" onClick={() => onShift(-1)}>
          <ChevronLeft aria-hidden />
        </Button>
        <div className="relative flex-1 text-center">
          <button
            type="button"
            className="h-11 rounded-full px-4 text-[17px] font-semibold"
            onClick={() => {
              const el = inputRef.current;
              if (!el) return;
              if (typeof el.showPicker === "function") el.showPicker();
              else el.focus();
            }}
            aria-label={`Change date, currently ${friendlyDate(date, today)}`}
          >
            {friendlyDate(date, today)}
          </button>
          <input ref={inputRef} type="date" value={date} max={today} onChange={(e) => e.target.value && onChange(e.target.value)} className="pointer-events-none absolute inset-0 opacity-0" tabIndex={-1} aria-hidden />
        </div>
        <Button variant="ghost" size="icon" aria-label="Next day" onClick={() => onShift(1)} disabled={date >= today}>
          <ChevronRight aria-hidden />
        </Button>
        {right}
      </div>
    </div>
  );
}
