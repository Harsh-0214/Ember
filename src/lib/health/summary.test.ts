import { describe, expect, it } from "vitest";
import { formatSleep, summarizeHealth } from "./summary";

describe("summarizeHealth", () => {
  it("sums cumulative metrics and takes latest resting HR", () => {
    const s = summarizeHealth([
      { metric: "steps", value: 4000, start_at: "2026-11-08T10:00:00Z", end_at: null },
      { metric: "steps", value: 3500.4, start_at: "2026-11-08T15:00:00Z", end_at: null },
      { metric: "active_energy", value: 320.6, start_at: "2026-11-08T00:00:00Z", end_at: null },
      { metric: "resting_heart_rate", value: 58, start_at: "2026-11-07T08:00:00Z", end_at: null },
      { metric: "resting_heart_rate", value: 55, start_at: "2026-11-08T08:00:00Z", end_at: null },
      { metric: "sleep", value: 435, start_at: "2026-11-08T04:00:00Z", end_at: "2026-11-08T11:15:00Z" },
    ]);
    expect(s).toMatchObject({ steps: 7500, activeKcal: 321, restingHr: 55, sleepMinutes: 435, avgHr: null, distanceM: null });
    expect(formatSleep(435)).toBe("7h 15m");
    expect(formatSleep(null)).toBe("—");
  });
});
