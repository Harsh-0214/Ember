import { describe, expect, it } from "vitest";
import { addDays, ageOn, dateRange, daysBetween, friendlyDate, isLocalDate, isValidTimeZone, localDateOf, localDayBounds, startOfWeek, timeAgo, weekday } from ".";

describe("dates", () => {
  it("assigns instants to the local date across time zone boundaries", () => {
    // 2026-11-08 03:30Z is still Nov 7 in Toronto (UTC−5 after DST ends)
    expect(localDateOf("2026-11-08T03:30:00Z", "America/Toronto")).toBe("2026-11-07");
    expect(localDateOf("2026-11-08T05:30:00Z", "America/Toronto")).toBe("2026-11-08");
    // and already Nov 8 in Tokyo
    expect(localDateOf("2026-11-07T16:00:00Z", "Asia/Tokyo")).toBe("2026-11-08");
    // offsets in timestamps are respected
    expect(localDateOf("2026-07-01T23:30:00-04:00", "America/Toronto")).toBe("2026-07-01");
  });
  it("falls back to the default zone for invalid zones", () => {
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(localDateOf("2026-11-08T03:30:00Z", "Not/AZone")).toBe("2026-11-07");
  });
  it("does calendar arithmetic", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    // DST change in Toronto (Mar 8 2026) doesn't affect date math
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09");
    expect(daysBetween("2026-03-01", "2026-03-31")).toBe(30);
    expect(dateRange("2026-11-01", "2026-11-03")).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(weekday("2026-11-08")).toBe(0);
    expect(startOfWeek("2026-11-08", 1)).toBe("2026-11-02");
    expect(startOfWeek("2026-11-09", 1)).toBe("2026-11-09");
  });
  it("computes local day bounds including DST days", () => {
    const { start, end } = localDayBounds("2026-11-01", "America/Toronto");
    expect(start.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    // DST ends Nov 1 2026 → 25-hour day
    expect(end.toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });
  it("computes age", () => {
    expect(ageOn("1990-11-09", "2026-11-08")).toBe(35);
    expect(ageOn("1990-11-08", "2026-11-08")).toBe(36);
  });
  it("labels dates", () => {
    expect(friendlyDate("2026-11-08", "2026-11-08")).toBe("Today");
    expect(friendlyDate("2026-11-07", "2026-11-08")).toBe("Yesterday");
    expect(friendlyDate("2026-11-03", "2026-11-08")).toBe("Tue, Nov 3");
    expect(isLocalDate("2026-13-01")).toBe(false);
    expect(isLocalDate("2026-11-08")).toBe(true);
    expect(timeAgo(new Date("2026-11-08T10:00:00Z"), new Date("2026-11-08T10:05:00Z"))).toBe("5 min ago");
  });
});
