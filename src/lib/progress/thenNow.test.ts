import { describe, expect, it } from "vitest";
import { thenAndNow } from "./thenNow";
import { shiftKey } from "./dates";
import type { MetricType, TrackingRecord } from "./types";

const today = "2026-10-24";
let n = 0;
const rec = (metric: MetricType, daysAgo: number, value: number): TrackingRecord => {
  const d = shiftKey(today, -daysAgo);
  return { id: `r${n++}`, userId: "u", metric, value, unit: metric === "water" ? "ml" : metric === "sleep" ? "min" : "score", source: "manual", recordedAt: `${d}T08:00:00Z`, localDate: d, createdAt: `${d}T08:00:00Z`, updatedAt: `${d}T08:00:00Z` };
};

describe("then and now", () => {
  it("compares a month ago with the last week", () => {
    const records = [rec("sleep", 33, 300), rec("sleep", 31, 330), rec("sleep", 2, 400), rec("sleep", 1, 420), rec("water", 32, 1000), rec("water", 30, 1200), rec("water", 3, 2000), rec("water", 0, 2200)];
    const r = thenAndNow(records, [], today)!;
    expect(r.basis).toBe("month");
    const sleep = r.rows.find((x) => x.metric === "sleep")!;
    expect(sleep.then).toBe(315);
    expect(sleep.now).toBe(410);
    expect(sleep.better).toBe(true);
    expect(r.rows.find((x) => x.metric === "water")!.change).toBe(1000);
  });
  it("uses his first week when he's newer than a month", () => {
    const records = [rec("energy", 20, 2), rec("energy", 19, 2), rec("energy", 1, 4), rec("energy", 0, 4)];
    const r = thenAndNow(records, [shiftKey(today, -20), shiftKey(today, -1), shiftKey(today, -2)], today)!;
    expect(r.basis).toBe("start");
    expect(r.thenFrom).toBe(shiftKey(today, -20));
    expect(r.rows.map((x) => x.metric)).toEqual(["energy", "cards"]);
  });
  it("says nothing when he's too new or recorded too little", () => {
    expect(thenAndNow([rec("sleep", 5, 300), rec("sleep", 1, 400)], [], today)).toBeNull();
    expect(thenAndNow([rec("sleep", 30, 300), rec("sleep", 1, 400)], [], today)).toBeNull();
  });
});
