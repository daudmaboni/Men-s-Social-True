import { describe, expect, it } from "vitest";
import type { FeedDB } from "./store";
import { activeDays, triedPoints } from "./engine";
import { mergeFeed } from "../account/merge";
import { markDeleted } from "../account/tombstones";
import { dueHelpedCheck, helpedYes } from "../social/helped";
import { nextWeekTip, showWeek, summarizeWeek, weekKeys } from "./week";
import type { TrackingRecord } from "../progress/types";

const base = (over: Partial<FeedDB> = {}): FeedDB => ({ days: {}, lessons: {}, settings: { discreet: false }, deleted: {}, course: {}, tried: {}, ...over });

describe("I did it earns points and follows him (Step 79)", () => {
  it("points count on the day he did it, and that day counts as active", () => {
    const feed = base({ tried: { "do-kegel": { localDate: "2026-10-20", at: "2026-10-20T08:00:00.000Z", points: 10 } } });
    expect(triedPoints(feed, "2026-10-20")).toBe(10);
    expect(triedPoints(feed, "2026-10-21")).toBe(0);
    expect(activeDays(feed, [])).toEqual(["2026-10-20"]);
  });

  it("two phones: the first time counts, and the newest Did it help answer wins", () => {
    const a = base({ tried: { x: { localDate: "2026-10-20", at: "2026-10-20T08:00:00.000Z", points: 10, helped: { answer: "some", at: "2026-10-24T08:00:00.000Z" } } } });
    const b = base({ tried: { x: { localDate: "2026-10-21", at: "2026-10-21T08:00:00.000Z", points: 10, helped: { answer: "yes", at: "2026-10-25T08:00:00.000Z" } } } });
    const m = mergeFeed(a, b);
    expect(m.tried?.x.localDate).toBe("2026-10-20");
    expect(m.tried?.x.helped?.answer).toBe("yes");
  });

  it("taking it back on one phone removes it on the other, but doing it again later brings it back", () => {
    const now = new Date("2026-10-22T10:00:00.000Z");
    const phone1 = base({ deleted: markDeleted({}, "tried:x", "2026-10-21T09:00:00.000Z") });
    const phone2 = base({ tried: { x: { localDate: "2026-10-20", at: "2026-10-20T08:00:00.000Z", points: 10 } } });
    expect(mergeFeed(phone1, phone2, now).tried?.x).toBeUndefined();
    const again = base({ tried: { x: { localDate: "2026-10-22", at: "2026-10-22T08:00:00.000Z", points: 10 } } });
    expect(mergeFeed(phone1, again, now).tried?.x).toBeDefined();
  });
});

describe("Did it help? (Step 79)", () => {
  const now = new Date("2026-10-23T10:00:00.000Z");
  const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
  it("asks about the newest card done 3 to 30 days ago, and never twice", () => {
    const tried = {
      old: { localDate: "x", at: at(40), points: 10 },
      fresh: { localDate: "x", at: at(1), points: 10 },
      a: { localDate: "x", at: at(10), points: 10 },
      b: { localDate: "x", at: at(4), points: 10 },
      answered: { localDate: "x", at: at(5), points: 10, helped: { answer: "no" as const, at: at(1) } },
    };
    expect(dueHelpedCheck(tried, now)).toBe("b");
    expect(dueHelpedCheck({ fresh: tried.fresh, old: tried.old }, now)).toBeNull();
  });
  it("a Yes counts like Useful for his feed", () => {
    expect(helpedYes({ a: { localDate: "x", at: at(5), points: 10, helped: { answer: "yes", at: at(1) } }, b: { localDate: "x", at: at(5), points: 10 } })).toEqual({ a: at(1) });
  });
});

describe("week in review (Step 79)", () => {
  it("Sunday shows this week so far; Monday shows last week", () => {
    expect(weekKeys("2026-10-25", 7)).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
    expect(weekKeys("2026-10-26", 1)).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
    expect(showWeek(7)).toBe(true);
    expect(showWeek(1)).toBe(true);
    expect(showWeek(3)).toBe(false);
    expect(showWeek(3, true)).toBe(true);
  });

  it("counts only what he recorded; averages skip empty days", () => {
    const keys = weekKeys("2026-10-25", 7);
    const feed = base({
      days: { "2026-10-20": { walk: { status: "done", at: "" }, breathe: { status: "skipped", at: "" } } },
      tried: { c: { localDate: "2026-10-22", at: "2026-10-22T08:00:00.000Z", points: 10 } },
      lessons: { l: { localDate: "2026-10-12", at: "" } }, // before the week
    });
    const rec = (metric: "sleep" | "water", localDate: string, value: number) => ({ metric, localDate, value }) as unknown as TrackingRecord;
    const records = [rec("sleep", "2026-10-21", 420), rec("sleep", "2026-10-22", 360), rec("water", "2026-10-21", 1000), rec("water", "2026-10-21", 500)];
    const w = summarizeWeek(keys, feed, records, (k) => (k === "2026-10-20" ? 15 : k === "2026-10-22" ? 10 : 0));
    expect(w).toMatchObject({ daysActive: 3, activitiesDone: 1, lessons: 0, cardsDone: 1, points: 25, sleepAvg: 390, sleepNights: 2, waterAvg: 1500, waterDays: 1 });
    expect(nextWeekTip(w, { sleepMin: 420, waterMl: 2500 })).toMatch(/sleep on more nights/);
  });
});
