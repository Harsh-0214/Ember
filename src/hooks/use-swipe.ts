"use client";
import { useRef } from "react";

/**
 * Horizontal swipe detection for day navigation. Ignores gestures that start
 * inside elements marked with [data-no-swipe] (e.g. swipeable entry rows).
 */
export function useSwipe(onLeft: () => void, onRight: () => void, threshold = 70) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") return;
      if ((e.target as HTMLElement).closest("[data-no-swipe],input,textarea,button[role=slider]")) return;
      start.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy) * 2 && Date.now() - s.t < 700) {
        if (dx < 0) onLeft();
        else onRight();
      }
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}
