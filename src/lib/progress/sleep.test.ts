import { describe, expect, it } from "vitest";
import { averageClock, clockSpread, estimateFromSeen, mergeSeen, sessionMinutes, sleepCategory, weekInsight, weekSummary } from "./sleep";

// Local times in the test's timezone
const at = (d: string) => new Date(d).getTime();

describe("sessionMinutes", () => {
  it("crosses midnight", () => {
    expect(sessionMinutes("2026-10-16T23:40:00", "2026-10-17T07:10:00")).toBe(450);
  });
  it("rejects missing, reversed, too short and too long", () => {
    expect(sessionMinutes(null, "2026-10-17T07:10:00")).toBeNull();
    expect(sessionMinutes("2026-10-17T07:10:00", "2026-10-16T23:40:00")).toBeNull();
    expect(sessionMinutes("2026-10-17T07:00:00", "2026-10-17T07:30:00")).toBeNull();
    expect(sessionMinutes("2026-10-16T07:00:00", "2026-10-17T07:30:00")).toBeNull();
  });
});

describe("sleepCategory", () => {
  it("uses the adult bands at their edges", () => {
    expect(sleepCategory(0)).toBeNull();
    expect(sleepCategory(299)).toBe("very_short");
    expect(sleepCategory(300)).toBe("insufficient");
    expect(sleepCategory(419)).toBe("insufficient");
    expect(sleepCategory(420)).toBe("within_target");
    expect(sleepCategory(540)).toBe("within_target");
    expect(sleepCategory(541)).toBe("long_sleep");
  });
});

describe("averageClock", () => {
  it("averages across midnight", () => {
    expect(averageClock(["23:30", "00:30"])).toBe("00:00");
    expect(averageClock(["06:00", "07:00"])).toBe("06:30");
    expect(averageClock([])).toBeNull();
  });
  it("measures spread", () => {
    expect(clockSpread(["23:00", "23:00"])).toBe(0);
    expect(clockSpread(["22:00", "00:00"])).toBe(60);
  });
});

describe("estimateFromSeen", () => {
  it("finds the night gap between evening and morning use", () => {
    const seen: [number, number][] = [
      [at("2026-10-16T20:00:00"), at("2026-10-16T20:30:00")],
      [at("2026-10-16T23:00:00"), at("2026-10-16T23:40:00")],
      [at("2026-10-17T07:10:00"), at("2026-10-17T07:12:00")],
    ];
    const e = estimateFromSeen(seen, at("2026-10-17T07:12:00"))!;
    expect(e.minutes).toBe(450);
    expect(e.confidence).toBeLessThan(0.5);
  });
  it("gives nothing without evening use, without morning use, or outside the morning", () => {
    expect(estimateFromSeen([[at("2026-10-17T07:10:00"), at("2026-10-17T07:12:00")]], at("2026-10-17T07:12:00"))).toBeNull();
    expect(estimateFromSeen([[at("2026-10-16T23:00:00"), at("2026-10-16T23:40:00")]], at("2026-10-17T07:12:00"))).toBeNull();
    const seen: [number, number][] = [
      [at("2026-10-16T23:00:00"), at("2026-10-16T23:40:00")],
      [at("2026-10-17T07:10:00"), at("2026-10-17T07:12:00")],
    ];
    expect(estimateFromSeen(seen, at("2026-10-17T18:00:00"))).toBeNull();
  });
  it("ignores daytime gaps and too-short gaps", () => {
    const seen: [number, number][] = [
      [at("2026-10-17T01:00:00"), at("2026-10-17T01:10:00")],
      [at("2026-10-17T03:00:00"), at("2026-10-17T03:05:00")],
    ];
    expect(estimateFromSeen(seen, at("2026-10-17T03:05:00"))).toBeNull();
  });
  it("merges overlapping stretches", () => {
    expect(mergeSeen([[5, 10], [0, 6], [20, 30]], 0)).toEqual([[0, 10], [20, 30]]);
  });
});

describe("weekSummary", () => {
  const n = (minutes: number, bedtime = "23:00", wakeTime = "06:30", status: "estimated" | "confirmed" = "confirmed") => ({ minutes, bedtime, wakeTime, status });
  it("averages only recorded nights and counts the rest as missing", () => {
    const w = weekSummary([n(420), null, n(480), n(450, "23:00", "06:30", "estimated"), null, null, null], [], 420);
    expect(w.nights).toBe(3);
    expect(w.missing).toBe(4);
    expect(w.average).toBe(450);
    expect(w.withinGoal).toBe(3);
    expect(w.lowConfidence).toBe(1);
    expect(w.change).toBeNull();
  });
  it("only gives an insight with 3+ nights", () => {
    const one = weekSummary([n(300)], [], 420);
    expect(weekInsight(one, 420)?.text).toMatch(/few more nights/);
    const short = weekSummary([n(380), n(390), n(400)], [], 420);
    expect(weekInsight(short, 420)?.text).toMatch(/less than your goal/);
  });
});
