import { describe, expect, it } from "vitest";
import {
  adherence,
  averageRecorded,
  dayLatest,
  dayTotal,
  daysGoalMet,
  energyBalance,
  goalStreak,
  measurementChange,
  metricStatus,
  periodChange,
  sleepMinutes,
  targetProgress,
} from "./calc";
import { dateKey, lastNDays, shiftKey } from "./dates";
import type { TrackingRecord } from "./types";

const rec = (localDate: string, value: number): TrackingRecord => ({
  id: `${localDate}-${value}`,
  userId: "local",
  metric: "water",
  value,
  unit: "ml",
  source: "manual",
  recordedAt: `${localDate}T08:00:00.000Z`,
  localDate,
  createdAt: "",
  updatedAt: "",
});

describe("targetProgress", () => {
  it("matches the spec example: 1800 of 2500 ml = 72%", () => {
    expect(targetProgress(1800, 2500)).toBe(72);
  });
  it("caps at 100%", () => {
    expect(targetProgress(3000, 2500)).toBe(100);
  });
  it("returns null (not 0) when nothing is recorded or the goal is missing", () => {
    expect(targetProgress(null, 2500)).toBeNull();
    expect(targetProgress(1000, 0)).toBeNull();
    expect(targetProgress(1000, null)).toBeNull();
  });
});

describe("other formulas", () => {
  it("adherence: 5 of 7 ≈ 71.4%", () => {
    expect(adherence(5, 7)).toBeCloseTo(71.43, 1);
    expect(adherence(0, 0)).toBeNull();
  });
  it("measurement change: 87 − 90 = −3", () => {
    expect(measurementChange(87, 90)).toBe(-3);
    expect(measurementChange(null, 90)).toBeNull();
  });
  it("energy balance: 2100 − 2500 = −400", () => {
    expect(energyBalance(2100, 2500)).toBe(-400);
    expect(energyBalance(2100, null)).toBeNull();
  });
});

describe("status and daily totals", () => {
  it("has three honest states", () => {
    expect(metricStatus(null, 2500)).toBe("not_recorded");
    expect(metricStatus(1000, 2500)).toBe("tracked");
    expect(metricStatus(2500, 2500)).toBe("goal_achieved");
  });
  it("sums a day, and returns null for a day with no records", () => {
    const records = [rec("2026-10-13", 250), rec("2026-10-13", 500), rec("2026-10-12", 300)];
    expect(dayTotal(records, "water", "2026-10-13")).toBe(750);
    expect(dayTotal(records, "water", "2026-10-11")).toBeNull();
  });
  it("averages recorded days only — missing days are not zeros", () => {
    expect(averageRecorded([2000, null, 3000, null])).toBe(2500);
    expect(averageRecorded([null, null])).toBeNull();
  });
  it("counts days the goal was met", () => {
    expect(daysGoalMet([2500, 1000, null, 3000], 2500)).toBe(2);
  });
  it("streak ignores an unfinished today but breaks on a missed day", () => {
    expect(goalStreak([2500, 2600, 2500, 800], 2500)).toBe(3);
    expect(goalStreak([2500, null, 2500, 2500], 2500)).toBe(2);
  });
});

describe("dates", () => {
  it("uses the man's timezone: 23:30 UTC is already tomorrow in Dar es Salaam", () => {
    const d = new Date("2026-10-13T23:30:00Z");
    expect(dateKey(d, "UTC")).toBe("2026-10-13");
    expect(dateKey(d, "Africa/Dar_es_Salaam")).toBe("2026-10-14");
  });
  it("shifts across month and year ends", () => {
    expect(shiftKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftKey("2026-02-28", 1)).toBe("2026-03-01");
  });
  it("gives the last 7 days, oldest first, ending today", () => {
    const keys = lastNDays(7, new Date("2026-10-13T09:00:00Z"), "Africa/Dar_es_Salaam");
    expect(keys).toEqual([
      "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13",
    ]);
  });
});

describe("sleep and check-ins", () => {
  it("works out sleep across midnight: 22:30 → 06:15 = 7h 45m", () => {
    expect(sleepMinutes("22:30", "06:15")).toBe(465);
    expect(sleepMinutes("01:00", "07:30")).toBe(390);
  });
  it("rejects bad or equal times", () => {
    expect(sleepMinutes("25:00", "06:00")).toBeNull();
    expect(sleepMinutes("22:00", "22:00")).toBeNull();
    expect(sleepMinutes("", "06:00")).toBeNull();
  });
  it("uses the latest answer of the day", () => {
    const a = { ...rec("2026-10-13", 2), metric: "energy" as const, updatedAt: "2026-10-13T07:00:00Z" };
    const b = { ...rec("2026-10-13", 4), id: "b", metric: "energy" as const, updatedAt: "2026-10-13T09:00:00Z" };
    expect(dayLatest([a, b], "energy", "2026-10-13")?.value).toBe(4);
    expect(dayLatest([a, b], "energy", "2026-10-12")).toBeNull();
  });
  it("compares periods only when both have data", () => {
    expect(periodChange(3.6, 2.8)).toBeCloseTo(0.8);
    expect(periodChange(3.6, null)).toBeNull();
  });
});
