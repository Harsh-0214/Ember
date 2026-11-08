import { describe, expect, it } from "vitest";
import { cmToFtIn, cupsToMl, formatHeight, formatVolume, formatWeight, formatWeightDelta, ftInToCm, kgToLb, lbToKg, round, toKcal, toKg, toMeters, toMl, waterPresets, weightToKg } from ".";

describe("units", () => {
  it("round-trips kg and lb", () => {
    expect(round(kgToLb(100), 2)).toBe(220.46);
    expect(round(lbToKg(220.462), 2)).toBe(100);
    expect(weightToKg(180, "imperial")).toBeCloseTo(81.65, 2);
    expect(weightToKg(80, "metric")).toBe(80);
  });
  it("converts height", () => {
    expect(cmToFtIn(180)).toEqual({ ft: 5, in: 11 });
    expect(cmToFtIn(182.88)).toEqual({ ft: 6, in: 0 });
    // rounding up to 12 inches rolls over
    expect(cmToFtIn(182.6)).toEqual({ ft: 6, in: 0 });
    expect(round(ftInToCm(5, 10), 1)).toBe(177.8);
    expect(formatHeight(177.8, "imperial")).toBe("5′10″");
    expect(formatHeight(177.8, "metric")).toBe("178 cm");
  });
  it("formats weight and deltas", () => {
    expect(formatWeight(80, "metric")).toBe("80.0 kg");
    expect(formatWeight(80, "imperial")).toBe("176.4 lb");
    expect(formatWeight(null, "metric")).toBe("—");
    expect(formatWeightDelta(-0.42, "metric")).toBe("−0.4 kg");
    expect(formatWeightDelta(0.5, "imperial")).toBe("+1.1 lb");
  });
  it("formats volume and water presets", () => {
    expect(formatVolume(250, "metric")).toBe("250 ml");
    expect(formatVolume(2500, "metric")).toBe("2.5 L");
    expect(formatVolume(cupsToMl(2), "imperial")).toBe("2 cups");
    expect(waterPresets("imperial")[0]).toEqual({ label: "+1 cup", ml: 237 });
    expect(waterPresets("metric").map((p) => p.ml)).toEqual([250, 500]);
  });
  it("normalises arbitrary unit strings", () => {
    expect(toKg(176.37, "lb")).toBeCloseTo(80, 1);
    expect(toKg(80000, "g")).toBe(80);
    expect(toKg(12, "st")).toBeCloseTo(76.2, 1);
    expect(toKg(1, "furlong")).toBeNull();
    expect(toKcal(418.4, "kJ")).toBeCloseTo(100, 5);
    expect(toKcal(250, "kcal")).toBe(250);
    expect(toMl(16, "fl_oz_us")).toBeCloseTo(473.18, 1);
    expect(toMl(1.5, "L")).toBe(1500);
    expect(toMeters(1, "mi")).toBeCloseTo(1609.344, 3);
    expect(toMeters(5, "km")).toBe(5000);
  });
});
