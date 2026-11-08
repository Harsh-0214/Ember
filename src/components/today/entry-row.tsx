"use client";
import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { describeAmount } from "@/lib/foods/amount";
import type { FoodEntry } from "@/lib/data/types";
import { haptic } from "@/lib/utils";

const OPEN = -88;

/** Diary row: tap to edit, swipe left to delete (with undo). */
export function EntryRow({ entry, onEdit, onDelete }: { entry: FoodEntry; onEdit: () => void; onDelete: () => void }) {
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; base: number; locked: "h" | "v" | null } | null>(null);
  const rowRef = useRef<HTMLLIElement>(null);
  const moved = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, base: x, locked: null };
    moved.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.locked) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        s.locked = "h";
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setDragging(true);
      } else if (Math.abs(dy) > 8) s.locked = "v";
    }
    if (s.locked === "h") {
      moved.current = true;
      setX(Math.min(0, s.base + dx));
    }
  };
  const onPointerUp = () => {
    const s = start.current;
    start.current = null;
    setDragging(false);
    if (!s || s.locked !== "h") return;
    const width = rowRef.current?.offsetWidth ?? 360;
    if (x < -width * 0.45) {
      haptic(12);
      setX(-width);
      setTimeout(onDelete, 150);
    } else if (x < OPEN / 2) setX(OPEN);
    else setX(0);
  };

  return (
    <li ref={rowRef} className="relative overflow-hidden" data-no-swipe>
      <button type="button" onClick={onDelete} className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center gap-1 bg-destructive text-sm font-semibold text-destructive-foreground" aria-label={`Delete ${entry.name}`} tabIndex={x === OPEN ? 0 : -1}>
        <Trash2 className="size-4" aria-hidden /> Delete
      </button>
      <button
        type="button"
        className="relative flex min-h-14 w-full touch-pan-y items-center justify-between gap-3 bg-card px-4 py-2.5 text-left"
        style={{ transform: `translateX(${x}px)`, transition: dragging ? "none" : "transform 200ms ease" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => {
          if (moved.current) return;
          if (x !== 0) return setX(0);
          onEdit();
        }}
      >
        <span className="min-w-0">
          <span className="block truncate text-[15px]">{entry.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {[entry.brand, describeAmount(entry)].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="shrink-0 text-[15px] tabular">{Math.round(Number(entry.kcal))}</span>
      </button>
    </li>
  );
}
