import { describe, expect, it } from "vitest";
import { ACTIVITIES, LESSONS, type Activity } from "./catalog";
import {
  activityStatus,
  dayPoints,
  forgivingStreak,
  levelFor,
  orderForSlot,
  pickForDay,
  timeSlot,
  totalPoints,
} from "./engine";
import type { FeedDB } from "./store";
import type { Goal, TrackingRecord } from "../progress/types";

const DAY = "2026-10-13";
const emptyFeed = (): FeedDB => ({ days: {}, lessons: {}, settings: { discreet: false } });
const goals: Goal[] = [{ metric: "water", target: 2000, unit: "ml", period: "day", direction: "increase", updatedAt: "" }];
const rec = (metric: TrackingRecord["metric"], value: number, localDate = DAY): TrackingRecord => ({
  id: `${metric}-${value}-${localDate}`,
  userId: "local",
  metric,
  value,
  unit: metric === "water" ? "ml" : metric === "sleep" ? "min" : "score",
  source: "manual",
  recordedAt: `${localDate}T08:00:00Z`,
  localDate,
  createdAt: "",
  updatedAt: `${localDate}T08:00:00Z`,
});
const byId = (id: string) => ACTIVITIES.find((a) => a.id === id) as Activity;

describe("activity status", () => {
  it("manual activities follow his choice", () => {
    const feed = emptyFeed();
    expect(activityStatus(byId("walk"), feed, [], goals, DAY)).toBe("pending");
    feed.days[DAY] = { walk: { status: "done", at: "" }, breathe: { status: "later", at: "" } };
    expect(activityStatus(byId("walk"), feed, [], goals, DAY)).toBe("done");
    expect(activityStatus(byId("breathe"), feed, [], goals, DAY)).toBe("later");
  });
  it("tracker activities complete only from real records", () => {
    const feed = emptyFeed();
    expect(activityStatus(byId("checkin"), feed, [rec("energy", 3)], goals, DAY)).toBe("pending");
    expect(activityStatus(byId("checkin"), feed, [rec("energy", 3), rec("mood", 4)], goals, DAY)).toBe("done");
    expect(activityStatus(byId("water"), feed, [rec("water", 1500)], goals, DAY)).toBe("pending");
    expect(activityStatus(byId("water"), feed, [rec("water", 1500), rec("water", 500)], goals, DAY)).toBe("done");
    feed.days[DAY] = { sleep: { status: "done", at: "" } };
    expect(activityStatus(byId("sleep"), feed, [], goals, DAY)).toBe("pending"); // can't fake it
  });
});

describe("points, level and order", () => {
  it("adds points for completed activities and lessons that day", () => {
    const feed = emptyFeed();
    feed.days[DAY] = { walk: { status: "done", at: "" }, breathe: { status: "skipped", at: "" } };
    feed.lessons[LESSONS[0].id] = { localDate: DAY, at: "" };
    const records = [rec("energy", 3), rec("mood", 3)];
    // walk 15 + check-in 10 + lesson 10
    expect(dayPoints(ACTIVITIES, LESSONS, feed, records, goals, DAY)).toBe(35);
    expect(totalPoints(ACTIVITIES, LESSONS, feed, records, goals)).toBe(35);
  });
  it("points disappear if the record behind them is deleted", () => {
    expect(totalPoints(ACTIVITIES, LESSONS, emptyFeed(), [rec("energy", 3)], goals)).toBe(0);
  });
  it("levels every 100 points", () => {
    expect(levelFor(0)).toEqual({ level: 1, into: 0, toNext: 100 });
    expect(levelFor(235)).toEqual({ level: 3, into: 35, toNext: 65 });
  });
  it("puts what fits the time of day first and finished items last", () => {
    const statuses = { checkin: "done", sleep: "pending", water: "pending", walk: "later", breathe: "pending", "screens-off": "skipped" } as const;
    const order = orderForSlot(ACTIVITIES, statuses, "morning").map((a) => a.id);
    expect(order[0]).toBe("sleep");
    expect(order.slice(-2).sort()).toEqual(["checkin", "screens-off"]);
  });
});

describe("forgiving streak", () => {
  const days = (...k: string[]) => new Set(k);
  it("counts consecutive days", () => {
    expect(forgivingStreak(days("2026-10-11", "2026-10-12", "2026-10-13"), "2026-10-13")).toBe(3);
  });
  it("an unfinished today does not break it", () => {
    expect(forgivingStreak(days("2026-10-11", "2026-10-12"), "2026-10-13")).toBe(2);
  });
  it("forgives one missed day", () => {
    expect(forgivingStreak(days("2026-10-09", "2026-10-10", "2026-10-12", "2026-10-13"), "2026-10-13")).toBe(4);
  });
  it("two missed days in a row end it", () => {
    expect(forgivingStreak(days("2026-10-08", "2026-10-09", "2026-10-12", "2026-10-13"), "2026-10-13")).toBe(2);
  });
  it("is zero with no activity", () => {
    expect(forgivingStreak(days(), "2026-10-13")).toBe(0);
  });
});

describe("time of day and daily rotation", () => {
  it("splits the day into morning, afternoon and evening", () => {
    expect(timeSlot(new Date(2026, 9, 13, 7))).toBe("morning");
    expect(timeSlot(new Date(2026, 9, 13, 14))).toBe("afternoon");
    expect(timeSlot(new Date(2026, 9, 13, 21))).toBe("evening");
    expect(timeSlot(new Date(2026, 9, 13, 2))).toBe("evening");
  });
  it("keeps the same pick all day and changes the next day", () => {
    expect(pickForDay(["a", "b", "c"], "2026-10-13")).toBe(pickForDay(["a", "b", "c"], "2026-10-13"));
    expect(pickForDay(["a", "b", "c"], "2026-10-13")).not.toBe(pickForDay(["a", "b", "c"], "2026-10-14"));
  });
});
