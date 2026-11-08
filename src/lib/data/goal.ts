import type { Goal } from "./types";

/** The goal in effect on a date (latest effective_from ≤ date). */
export function goalForDate<G extends Pick<Goal, "effective_from">>(goals: G[] | undefined, date: string): G | null {
  if (!goals?.length) return null;
  let best: G | null = null;
  for (const g of goals) {
    if (g.effective_from <= date && (!best || g.effective_from > best.effective_from)) best = g;
  }
  // Dates before the first goal use the earliest goal.
  return best ?? goals.reduce((a, b) => (a.effective_from < b.effective_from ? a : b));
}
