import { describe, expect, it } from "vitest";
import { bestStreak, computeBadges, firstActiveDay, type BadgeInput } from "./badges";
import type { TrackingRecord } from "../progress/types";

const rec = (metric: TrackingRecord["metric"], localDate: string, value: number): TrackingRecord => ({
  id: `${metric}-${localDate}-${value}`, userId: "local", metric, value, unit: metric === "water" ? "ml" : metric === "sleep" ? "min" : "score",
  source: "manual", recordedAt: `${localDate}T08:00:00Z`, localDate, createdAt: `${localDate}T08:00:00Z`, updatedAt: `${localDate}T08:00:00Z`,
});

const base: BadgeInput = {
  records: [], goals: [{ metric: "water", target: 2000, unit: "ml", period: "day", direction: "increase", updatedAt: "" }],
  feed: { days: {}, lessons: {}, settings: { discreet: false } }, points: 0, pointDays: new Set(), bookmarks: 0, posts: 0, replies: 0,
};
const badge = (i: BadgeInput, id: string) => computeBadges(i).find((b) => b.id === id)!;

describe("badges", () => {
  it("a new user has nothing earned and no fake progress", () => {
    const all = computeBadges(base);
    expect(all.every((b) => !b.earned)).toBe(true);
    expect(all.filter((b) => b.id !== "rising").every((b) => b.current === 0)).toBe(true);
  });
  it("counts water goal days from real totals (several glasses add up)", () => {
    const records = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"].flatMap((d) => [rec("water", d, 1000), rec("water", d, 1000)]);
    records.push(rec("water", "2026-10-06", 500)); // under the goal
    const b = badge({ ...base, records }, "hydration-hero");
    expect(b.current).toBe(5);
    expect(b.earned).toBe(true);
  });
  it("counts check-in days once even if energy and mood are both logged", () => {
    const records = [rec("energy", "2026-10-01", 3), rec("mood", "2026-10-01", 4), rec("mood", "2026-10-02", 4)];
    expect(badge({ ...base, records }, "know-yourself").current).toBe(2);
  });
  it("uses the best streak, forgiving one missed day", () => {
    const days = new Set(["2026-10-01", "2026-10-02", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"]);
    expect(bestStreak(days)).toBe(7);
    expect(badge({ ...base, pointDays: days }, "steady-week").earned).toBe(true);
    expect(bestStreak(new Set(["2026-10-01", "2026-10-04"]))).toBe(1);
  });
  it("caps progress at the target", () => {
    expect(badge({ ...base, bookmarks: 10 }, "collector").current).toBe(3);
    expect(badge({ ...base, points: 450 }, "rising").earned).toBe(true);
  });
  it("finds the first day he used the app", () => {
    expect(firstActiveDay({ ...base, records: [rec("water", "2026-10-05", 250)], feed: { ...base.feed, lessons: { a: { localDate: "2026-10-03", at: "" } } } })).toBe("2026-10-03");
    expect(firstActiveDay(base)).toBeNull();
  });
});
