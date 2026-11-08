import { describe, expect, it } from "vitest";
import { dailyInsight, type InsightInput } from ".";

const base: InsightInput = {
  hour: 19, isToday: true, entryCount: 6, kcal: 1500, budgetKcal: 2000, protein_g: 90, proteinTarget: 130,
  fiber_g: 25, fiberTarget: 28, water_ml: 2000, waterGoal_ml: 2500, weighedToday: true,
};

describe("dailyInsight", () => {
  it("suggests protein options when short in the evening", () => {
    const s = dailyInsight(base);
    expect(s).toMatch(/^You're 40 g short on protein; /);
    expect(s).toMatch(/would close the gap\.$/);
  });
  it("nudges to log when nothing is logged", () => {
    expect(dailyInsight({ ...base, entryCount: 0, kcal: 0, hour: 8 })).toMatch(/breakfast/);
    expect(dailyInsight({ ...base, entryCount: 0, kcal: 0, isToday: false })).toMatch(/fasted/);
  });
  it("reassures when over budget", () => {
    expect(dailyInsight({ ...base, kcal: 2300 })).toMatch(/300 kcal over/);
  });
  it("celebrates hitting targets", () => {
    expect(dailyInsight({ ...base, kcal: 1990, protein_g: 128 })).toMatch(/right on target/);
  });
  it("mentions water late in the day", () => {
    expect(dailyInsight({ ...base, protein_g: 125, water_ml: 800 })).toMatch(/Water is at 0.8 L/);
  });
  it("falls back to remaining calories", () => {
    expect(dailyInsight({ ...base, hour: 12, protein_g: 125 })).toBe("500 kcal left and 5 g protein to go.");
  });
});
