"use client";
import { Globe, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="px-1 pt-4 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</h2>;
}

/** A tappable food row with an optional one-tap quick-log button. */
export function FoodRow({
  name, sub, kcal, onSelect, onQuickAdd, quickLabel, online, onPointerDown,
}: {
  name: string;
  sub?: string | null;
  kcal: number | null;
  onSelect: () => void;
  onQuickAdd?: () => void;
  quickLabel?: string;
  online?: boolean;
  onPointerDown?: () => void;
}) {
  return (
    <li className="flex items-center gap-1 bg-card">
      <button type="button" onClick={onSelect} onPointerDown={onPointerDown} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 truncate text-[15px]">
            {online ? <Globe className="size-3.5 shrink-0 text-muted-foreground" aria-label="Online result" /> : null}
            <span className="truncate">{name}</span>
          </span>
          {sub ? <span className="block truncate text-xs text-muted-foreground">{sub}</span> : null}
        </span>
        {kcal != null ? <span className={cn("shrink-0 text-sm text-muted-foreground tabular", !onQuickAdd && "pr-4")}>{Math.round(kcal)}</span> : null}
      </button>
      {onQuickAdd ? (
        <button type="button" onClick={onQuickAdd} aria-label={quickLabel ?? `Log ${name}`} className="mr-1 grid size-11 shrink-0 place-items-center rounded-full text-primary hover:bg-muted active:scale-95">
          <Plus className="size-5" aria-hidden />
        </button>
      ) : null}
    </li>
  );
}

export function RowList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-border overflow-hidden rounded-2xl ring-1 ring-border/70">{children}</ul>;
}
