import { describe, expect, it } from "vitest";
import { goalForDate } from "./goal";

describe("goalForDate", () => {
  const goals = [{ effective_from: "2026-10-01", k: 1 }, { effective_from: "2026-11-01", k: 2 }];
  it("picks the latest goal on or before the date", () => {
    expect(goalForDate(goals, "2026-11-08")!.k).toBe(2);
    expect(goalForDate(goals, "2026-10-31")!.k).toBe(1);
    expect(goalForDate(goals, "2026-11-01")!.k).toBe(2);
  });
  it("falls back to the earliest goal for older dates", () => {
    expect(goalForDate(goals, "2026-01-01")!.k).toBe(1);
    expect(goalForDate([], "2026-01-01")).toBeNull();
  });
});
