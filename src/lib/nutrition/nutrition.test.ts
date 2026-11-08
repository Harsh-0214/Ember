import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import {
  alphaFor, assessRate, bmr, classifyDay, computeTargets, dailyBudget, dailyTrend, dailyWeights, dedupeWorkouts,
  detectPr, estimateAdaptiveTdee, estimated1RM, fillCarbs, formulaTdee, katchMcArdle, linearRegression, macroKcal,
  macrosConsistent, metCalories, mifflinStJeor, netMetCalories, overlapRatio, per100FromTotals, projectGoal,
  scaleNutrients, sumNutrients, trendAtWeighIns, trendOn,
} from ".";
import { simulate } from "../../../tests/fixtures/weights";

describe("BMR & TDEE", () => {
  it("Mifflin-St Jeor matches reference values", () => {
    // 80 kg, 180 cm, 30 y male: 10*80 + 6.25*180 − 5*30 + 5 = 1780
    expect(mifflinStJeor({ sex: "male", weightKg: 80, heightCm: 180, ageYears: 30 })).toBe(1780);
    // 65 kg, 165 cm, 40 y female: 650 + 1031.25 − 200 − 161 = 1320.25
    expect(mifflinStJeor({ sex: "female", weightKg: 65, heightCm: 165, ageYears: 40 })).toBeCloseTo(1320.25);
  });
  it("Katch-McArdle uses lean mass", () => {
    expect(katchMcArdle({ weightKg: 80, bodyFatPct: 20 })).toBeCloseTo(370 + 21.6 * 64);
  });
  it("only uses Katch when body fat is plausible", () => {
    const p = { sex: "male" as const, weightKg: 80, heightCm: 180, ageYears: 30 };
    expect(bmr({ ...p, method: "katch", bodyFatPct: 20 }).method).toBe("katch");
    expect(bmr({ ...p, method: "katch", bodyFatPct: null }).method).toBe("mifflin");
    expect(bmr({ ...p, method: "katch", bodyFatPct: 1 }).method).toBe("mifflin");
  });
  it("uses sedentary multiplier when exercise is added to the budget", () => {
    const p = { sex: "male" as const, weightKg: 80, heightCm: 180, ageYears: 30, activity: "active" as const };
    expect(formulaTdee(p)).toBeCloseTo(1780 * 1.725);
    expect(formulaTdee({ ...p, exerciseBudgetEnabled: true })).toBeCloseTo(1780 * 1.2);
  });
});

describe("targets", () => {
  it("applies the deficit for the weekly rate", () => {
    const t = computeTargets({ sex: "male", weightKg: 90, goalWeightKg: 80, tdeeKcal: 2800, goal: "lose", weeklyRateKg: -0.5 });
    expect(t.kcal).toBe(2250); // 2800 − 550
    expect(t.floorApplied).toBe(false);
    expect(t.protein_g).toBe(170); // 2.0 × midpoint 85 kg
    expect(Math.abs(macroKcal(t) - t.kcal)).toBeLessThan(20);
    expect(t.fat_g).toBeGreaterThanOrEqual(Math.round(0.6 * 90));
  });
  it("treats the rate sign leniently and maintains at 0", () => {
    const a = computeTargets({ sex: "female", weightKg: 60, tdeeKcal: 2000, goal: "lose", weeklyRateKg: 0.25 });
    expect(a.kcal).toBe(1730);
    const m = computeTargets({ sex: "female", weightKg: 60, tdeeKcal: 2000, goal: "maintain", weeklyRateKg: -1 });
    expect(m.kcal).toBe(2000);
    const g = computeTargets({ sex: "male", weightKg: 70, tdeeKcal: 2600, goal: "gain", weeklyRateKg: 0.25 });
    expect(g.kcal).toBe(2880);
    expect(g.protein_g).toBe(126);
  });
  it("never goes below the safety floor", () => {
    const f = computeTargets({ sex: "female", weightKg: 55, tdeeKcal: 1600, goal: "lose", weeklyRateKg: -1 });
    expect(f.kcal).toBe(1200);
    expect(f.floorApplied).toBe(true);
    expect(f.explanation).toMatch(/safety floor/);
    const m = computeTargets({ sex: "male", weightKg: 70, tdeeKcal: 1900, goal: "lose", weeklyRateKg: -1 });
    expect(m.kcal).toBe(1500);
    const custom = computeTargets({ sex: "male", weightKg: 70, tdeeKcal: 1900, goal: "lose", weeklyRateKg: -1, floorKcal: 1700 });
    expect(custom.kcal).toBe(1700);
  });
  it("keeps macros non-negative on tiny targets", () => {
    const t = computeTargets({ sex: "female", weightKg: 120, tdeeKcal: 1300, goal: "lose", weeklyRateKg: -1 });
    expect(t.carbs_g).toBeGreaterThanOrEqual(0);
    expect(t.protein_g * 4).toBeLessThanOrEqual(t.kcal * 0.4 + 4);
  });
  it("fills carbs after edits", () => {
    expect(fillCarbs(2000, 150, 60)).toBe(215);
    expect(fillCarbs(1000, 200, 80)).toBe(0);
  });
  it("assesses weekly rate safety", () => {
    expect(assessRate("lose", -0.5, 80).level).toBe("ok");
    expect(assessRate("lose", -1.0, 80).level).toBe("aggressive");
    expect(assessRate("lose", -1.5, 80).level).toBe("too_aggressive");
    expect(assessRate("gain", 0.25, 80).level).toBe("ok");
    expect(assessRate("gain", 0.6, 80).level).toBe("aggressive");
    expect(assessRate("lose", -0.5, 80).recommendedMin).toBe(-0.8);
  });
});

describe("trend weight", () => {
  it("has a 10-day half-life", () => {
    expect(alphaFor(10)).toBeCloseTo(0.5);
    expect(alphaFor(0)).toBe(0);
  });
  it("averages same-day weigh-ins and ignores junk", () => {
    const d = dailyWeights([
      { date: "2026-11-02", weightKg: 80 },
      { date: "2026-11-01", weightKg: 81 },
      { date: "2026-11-02", weightKg: 81 },
      { date: "2026-11-03", weightKg: NaN },
      { date: "2026-11-03", weightKg: 0 },
    ]);
    expect(d).toEqual([
      { date: "2026-11-01", weightKg: 81 },
      { date: "2026-11-02", weightKg: 80.5 },
    ]);
  });
  it("damps water-weight spikes", () => {
    const pts = Array.from({ length: 14 }, (_, i) => ({ date: addDays("2026-10-01", i), weightKg: 80 }));
    pts[10] = { date: pts[10]!.date, weightKg: 82.5 }; // salty dinner
    const t = trendAtWeighIns(pts);
    expect(t[10]!.trendKg).toBeLessThan(80.2);
    expect(t[13]!.trendKg).toBeLessThan(80.15);
  });
  it("handles missing days by decaying over the gap", () => {
    const t = trendAtWeighIns([
      { date: "2026-10-01", weightKg: 80 },
      { date: "2026-10-11", weightKg: 78 },
    ]);
    expect(t[1]!.trendKg).toBeCloseTo(79); // 10-day gap = half way
  });
  it("produces a daily series carrying values forward", () => {
    const s = dailyTrend([{ date: "2026-10-01", weightKg: 80 }, { date: "2026-10-04", weightKg: 79 }], "2026-10-05");
    expect(s.map((p) => p.date)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"]);
    expect(s[1]!.weightKg).toBeNull();
    expect(s[1]!.trendKg).toBe(80);
    expect(s[4]!.trendKg).toBe(s[3]!.trendKg);
    expect(dailyTrend([], "2026-10-05")).toEqual([]);
    expect(trendOn([{ date: "2026-10-01", weightKg: 80 }], "2026-09-30")).toBeNull();
  });
  it("linear regression recovers a slope", () => {
    const r = linearRegression([0, 1, 2, 3], [10, 12, 14, 16]);
    expect(r.slope).toBeCloseTo(2);
    expect(r.intercept).toBeCloseTo(10);
    expect(r.residualSd).toBeCloseTo(0);
  });
});

describe("adaptive TDEE", () => {
  const steady = () =>
    simulate({ start: "2026-08-01", days: 70, startWeightKg: 90, trueTdee: 2600, intake: (i) => 2100 + ((i * 37) % 200) - 100, targetKcal: 2100 });

  it("recovers the true TDEE with realistic noise", () => {
    const { days, weights, end } = steady();
    const r = estimateAdaptiveTdee({ days, weights, formulaTdee: 2400, endDate: end });
    expect(r.adaptiveTdee).not.toBeNull();
    expect(Math.abs(r.adaptiveTdee! - 2600)).toBeLessThan(180);
    expect(r.confidence).toBe("high");
    expect(r.blendWeight).toBe(1);
    expect(r.trendChangeKgPerWeek!).toBeLessThan(-0.3);
  });

  it("returns the formula estimate during the first week with no data", () => {
    const r = estimateAdaptiveTdee({ days: [], weights: [], formulaTdee: 2400, endDate: "2026-11-07" });
    expect(r.adaptiveTdee).toBeNull();
    expect(r.blendedTdee).toBe(2400);
    expect(r.confidence).toBe("none");
    expect(r.reason).toMatch(/Need 14/);
  });

  it("excludes partially logged days", () => {
    const partial: Record<number, number> = {};
    for (let i = 42; i < 70; i += 3) partial[i] = 0.3; // forgot to log dinner+
    const { days, weights, end } = simulate({ start: "2026-08-01", days: 70, startWeightKg: 90, trueTdee: 2600, intake: () => 2100, partial, targetKcal: 2100 });
    const r = estimateAdaptiveTdee({ days, weights, formulaTdee: 2400, endDate: end });
    expect(r.daysExcluded).toBe(10);
    expect(Math.abs(r.adaptiveTdee! - 2600)).toBeLessThan(180);
    // Classified as incomplete unless flagged
    expect(classifyDay({ date: "x", intakeKcal: 600, entryCount: 2, targetKcal: 2100 })).toBe("incomplete");
    expect(classifyDay({ date: "x", intakeKcal: 600, entryCount: 2, targetKcal: 2100, isComplete: true })).toBe("complete");
    expect(classifyDay({ date: "x", intakeKcal: 0, entryCount: 0, targetKcal: 2100, isFasted: true })).toBe("fasted");
    expect(classifyDay({ date: "x", intakeKcal: 0, entryCount: 0, targetKcal: 2100 })).toBe("empty");
  });

  it("tolerates missing days and water spikes", () => {
    const skipLog = new Set([45, 46, 52, 60]);
    const skipWeigh = new Set([44, 47, 48, 55, 61, 62, 63]);
    const { days, weights, end } = simulate({
      start: "2026-08-01", days: 70, startWeightKg: 90, trueTdee: 2600, intake: () => 2100, targetKcal: 2100,
      skipLog, skipWeigh, spikes: { 50: 2.0, 51: 1.2, 65: 1.5 },
    });
    const r = estimateAdaptiveTdee({ days, weights, formulaTdee: 2400, endDate: end });
    expect(r.adaptiveTdee).not.toBeNull();
    expect(Math.abs(r.adaptiveTdee! - 2600)).toBeLessThan(250);
  });

  it("blends gradually with ~14 days of data", () => {
    const { days, weights, end } = simulate({ start: "2026-10-01", days: 16, startWeightKg: 90, trueTdee: 2600, intake: () => 2100, targetKcal: 2100, noiseKg: 0.2 });
    const r = estimateAdaptiveTdee({ days, weights, formulaTdee: 2400, endDate: end });
    expect(r.blendWeight).toBeGreaterThan(0);
    expect(r.blendWeight).toBeLessThan(0.6);
    expect(r.blendedTdee).toBeGreaterThan(2300);
    expect(r.blendedTdee).toBeLessThan(2800);
  });

  it("clamps week-to-week change", () => {
    const { days, weights, end } = steady();
    const r = estimateAdaptiveTdee({ days, weights, formulaTdee: 2400, previousTdee: 2200, endDate: end });
    expect(r.blendedTdee).toBe(2350);
    expect(r.clamped).toBe(true);
  });

  it("flags implausible data with low confidence", () => {
    // Claims 1000 kcal/day but weight goes up fast → nonsense
    const { days, weights, end } = simulate({ start: "2026-08-01", days: 40, startWeightKg: 80, trueTdee: -2000, intake: () => 1000, targetKcal: 1000, noiseKg: 0.1 });
    const r = estimateAdaptiveTdee({ days, weights, formulaTdee: 2400, endDate: end });
    expect(r.confidence).toBe("low");
    expect(r.adaptiveTdee!).toBeGreaterThanOrEqual(1440);
  });
});

describe("projection", () => {
  it("projects a goal date from the trend slope", () => {
    const p = projectGoal({ today: "2026-11-08", trendKg: 85, goalKg: 80, slopeKgPerWeek: -0.5 });
    expect(p.status).toBe("on_track");
    expect(p.weeks).toBe(10);
    expect(p.date).toBe("2027-01-17");
  });
  it("handles edge cases", () => {
    expect(projectGoal({ today: "2026-11-08", trendKg: 80.1, goalKg: 80, slopeKgPerWeek: -0.5 }).status).toBe("reached");
    expect(projectGoal({ today: "2026-11-08", trendKg: 85, goalKg: 80, slopeKgPerWeek: 0.2 }).status).toBe("wrong_direction");
    expect(projectGoal({ today: "2026-11-08", trendKg: 85, goalKg: 80, slopeKgPerWeek: 0.0 }).status).toBe("too_slow");
    expect(projectGoal({ today: "2026-11-08", trendKg: null, goalKg: 80, slopeKgPerWeek: -0.5 }).status).toBe("no_data");
    expect(projectGoal({ today: "2026-11-08", trendKg: 85, goalKg: 80, slopeKgPerWeek: null, plannedRateKgPerWeek: -0.5 }).status).toBe("on_track");
  });
});

describe("exercise", () => {
  it("estimates MET calories", () => {
    // Running 6 mph (9.8 MET), 80 kg, 30 min → 392 kcal
    expect(metCalories({ met: 9.8, weightKg: 80, minutes: 30 })).toBeCloseTo(392);
    expect(metCalories({ met: 9.8, weightKg: 80, minutes: 30, intensity: "light" })).toBeCloseTo(333.2);
    expect(netMetCalories({ met: 9.8, weightKg: 80, minutes: 30 })).toBeCloseTo(352);
    expect(netMetCalories({ met: 0.8, weightKg: 80, minutes: 30 })).toBe(0);
  });
  it("detects PRs", () => {
    const hist = [
      { exercise: "Bench", weightKg: 80, reps: 5 },
      { exercise: "bench", weightKg: 85, reps: 3 },
      { exercise: "Bench", weightKg: 100, reps: 1, isWarmup: true },
    ];
    expect(detectPr({ exercise: "Bench", weightKg: 87.5, reps: 1 }, hist).isWeightPr).toBe(true);
    expect(detectPr({ exercise: "Bench", weightKg: 80, reps: 6 }, hist)).toMatchObject({ isWeightPr: false, isRepPr: true, is1RmPr: true });
    expect(detectPr({ exercise: "Bench", weightKg: 60, reps: 5 }, hist)).toEqual({ isWeightPr: false, is1RmPr: false, isRepPr: false });
    expect(detectPr({ exercise: "Squat", weightKg: 100, reps: 5 }, hist).isWeightPr).toBe(false);
    expect(estimated1RM(100, 1)).toBe(100);
    expect(estimated1RM(100, 10)).toBeCloseTo(133.33, 1);
  });
});

describe("workout de-duplication", () => {
  const base = { durationMin: null, kcalOverride: null };
  it("counts overlapping imported + manual workouts once", () => {
    const r = dedupeWorkouts([
      { ...base, id: "m", source: "manual", startedAt: "2026-11-08T12:00:00Z", endedAt: "2026-11-08T12:45:00Z", kcalEstimate: 400 },
      { ...base, id: "h", source: "apple_health", startedAt: "2026-11-08T12:02:00Z", endedAt: "2026-11-08T12:44:00Z", kcalEstimate: 350 },
      { ...base, id: "x", source: "apple_health", startedAt: "2026-11-08T18:00:00Z", endedAt: "2026-11-08T18:30:00Z", kcalEstimate: 200 },
    ]);
    expect(r.find((w) => w.workout.id === "m")!.duplicateOf).toBe("h");
    expect(r.reduce((s, w) => s + w.countedKcal, 0)).toBe(550);
  });
  it("keeps the manual override when present", () => {
    const r = dedupeWorkouts([
      { ...base, id: "h", source: "apple_health", startedAt: "2026-11-08T12:00:00Z", endedAt: "2026-11-08T13:00:00Z", kcalEstimate: 500 },
      { id: "m", source: "manual", startedAt: "2026-11-08T12:10:00Z", endedAt: null, durationMin: 40, kcalEstimate: 380, kcalOverride: 420 },
    ]);
    expect(r.find((w) => w.workout.id === "h")!.countedKcal).toBe(0);
    expect(r.find((w) => w.workout.id === "m")!.countedKcal).toBe(420);
  });
  it("does not merge workouts without times or with small overlap", () => {
    expect(overlapRatio(
      { ...base, id: "a", source: "manual", startedAt: null, endedAt: null, kcalEstimate: 1 },
      { ...base, id: "b", source: "apple_health", startedAt: "2026-11-08T12:00:00Z", endedAt: "2026-11-08T13:00:00Z", kcalEstimate: 1 },
    )).toBe(0);
    const r = dedupeWorkouts([
      { ...base, id: "a", source: "manual", startedAt: "2026-11-08T12:00:00Z", endedAt: "2026-11-08T13:00:00Z", kcalEstimate: 300 },
      { ...base, id: "b", source: "apple_health", startedAt: "2026-11-08T12:45:00Z", endedAt: "2026-11-08T13:45:00Z", kcalEstimate: 300 },
    ]);
    expect(r.every((w) => w.duplicateOf === null)).toBe(true);
  });
});

describe("budget & nutrients", () => {
  it("doesn't add exercise by default", () => {
    expect(dailyBudget(2000, 400, { enabled: false, pct: 100 }).budgetKcal).toBe(2000);
    expect(dailyBudget(1800, 400, { enabled: true, pct: 50 })).toEqual({ baseKcal: 1800, exerciseCredit: 200, budgetKcal: 2000 });
    expect(dailyBudget(1800, 400, { enabled: true, pct: 150 }).exerciseCredit).toBe(400);
  });
  it("scales and sums nutrients", () => {
    const egg = { kcal: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.5, fiber_g: 0, sugar_g: 0.4, sat_fat_g: 3.1, sodium_mg: 142 };
    const two = scaleNutrients(egg, 100);
    expect(two).toEqual(egg);
    const one = scaleNutrients(egg, 50);
    expect(one.kcal).toBe(71.5);
    expect(one.sodium_mg).toBe(71);
    expect(scaleNutrients({ ...egg, fiber_g: null }, 50).fiber_g).toBeNull();
    const total = sumNutrients([one, one, { kcal: 80, protein_g: 3 }]);
    expect(total.kcal).toBe(223);
    expect(total.protein_g).toBe(15.6);
    const per100 = per100FromTotals(total, 200);
    expect(per100.kcal).toBe(111.5);
    expect(macrosConsistent(egg)).toBe(true);
    expect(macrosConsistent({ kcal: 500, protein_g: 1, carbs_g: 1, fat_g: 1 })).toBe(false);
  });
});
