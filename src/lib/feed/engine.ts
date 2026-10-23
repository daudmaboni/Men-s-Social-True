// Works out the Home feed from real data: what's done, points, level and streak.
// Pure functions (no saving here), so they're easy to test.

import { dayLatest, dayTotal } from "../progress/calc";
import { shiftKey } from "../progress/dates";
import { challengeDates, challengePoints } from "../content/hooks";
import type { Goal, TrackingRecord } from "../progress/types";
import type { Activity, Lesson, Slot } from "./catalog";
import type { FeedDB } from "./store";

export type ActivityStatus = "pending" | "done" | "later" | "skipped";

export function timeSlot(d: Date = new Date()): Slot {
  const h = d.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  return "evening";
}

export function greeting(slot: Slot): string {
  return slot === "morning" ? "Good morning" : slot === "afternoon" ? "Good afternoon" : "Good evening";
}

/** Is a tracker activity complete on this day, based on his actual records? */
export function trackerDone(
  a: Activity,
  records: TrackingRecord[],
  goals: Goal[],
  key: string,
): boolean {
  if (a.tracker === "checkin") {
    return Boolean(dayLatest(records, "energy", key) && dayLatest(records, "mood", key));
  }
  if (a.tracker === "sleep") return Boolean(dayLatest(records, "sleep", key));
  if (a.tracker === "water") {
    const total = dayTotal(records, "water", key);
    const goal = goals.find((g) => g.metric === "water")?.target;
    return total !== null && goal !== undefined && total >= goal;
  }
  return false;
}

export function activityStatus(
  a: Activity,
  feed: FeedDB,
  records: TrackingRecord[],
  goals: Goal[],
  key: string,
): ActivityStatus {
  if (a.tracker && trackerDone(a, records, goals, key)) return "done";
  const choice = feed.days[key]?.[a.id]?.status;
  if (a.tracker && choice === "done") return "pending"; // tracker items can't be ticked by hand
  return choice ?? "pending";
}

/** Today's list: what fits the time of day first, then the rest; finished items last. */
export function orderForSlot(
  activities: Activity[],
  statuses: Record<string, ActivityStatus>,
  slot: Slot,
): Activity[] {
  const rank = (a: Activity) => {
    const s = statuses[a.id];
    if (s === "done" || s === "skipped") return 4;
    if (s === "later") return 3;
    if (a.slot === slot) return 0;
    if (a.slot === "any") return 1;
    return 2;
  };
  return [...activities].sort((x, y) => rank(x) - rank(y));
}

/** Points earned on one day from completed activities and lessons read that day. */
export function dayPoints(
  activities: Activity[],
  lessons: Lesson[],
  feed: FeedDB,
  records: TrackingRecord[],
  goals: Goal[],
  key: string,
): number {
  const fromActivities = activities
    .filter((a) => activityStatus(a, feed, records, goals, key) === "done")
    .reduce((s, a) => s + a.points, 0);
  const fromLessons = lessons
    .filter((l) => feed.lessons[l.id]?.localDate === key)
    .reduce((s, l) => s + l.points, 0);
  return fromActivities + fromLessons + coursePoints(feed, key) + triedPoints(feed, key) + challengePoints(feed.challenges, key);
}

/** Points from Discover cards he did on this day (Step 79). */
export function triedPoints(feed: FeedDB, key: string): number {
  return Object.values(feed.tried ?? {}).reduce((s, x) => s + (x?.localDate === key ? Math.max(0, x.points || 0) : 0), 0);
}

/** Points from course lessons he finished on this day (Step 48). */
export function coursePoints(feed: FeedDB, key: string): number {
  return Object.values(feed.course ?? {}).reduce((s, c) => s + (c.done?.localDate === key ? Math.max(0, c.done.points || 0) : 0), 0);
}

/** Every day he did anything (activity choice, lesson, or tracker record). */
export function activeDays(feed: FeedDB, records: TrackingRecord[]): string[] {
  const set = new Set<string>();
  Object.keys(feed.days).forEach((k) => set.add(k));
  Object.values(feed.lessons).forEach((l) => set.add(l.localDate));
  Object.values(feed.course ?? {}).forEach((c) => c.done && set.add(c.done.localDate));
  Object.values(feed.tried ?? {}).forEach((x) => x?.localDate && set.add(x.localDate));
  challengeDates(feed.challenges).forEach((k) => set.add(k));
  records.forEach((r) => set.add(r.localDate));
  return [...set].sort();
}

export function totalPoints(
  activities: Activity[],
  lessons: Lesson[],
  feed: FeedDB,
  records: TrackingRecord[],
  goals: Goal[],
): number {
  return activeDays(feed, records).reduce(
    (sum, k) => sum + dayPoints(activities, lessons, feed, records, goals, k),
    0,
  );
}

/** Level 1 at 0 points, +1 level every 100 points. */
export function levelFor(points: number) {
  const level = Math.floor(points / 100) + 1;
  return { level, into: points % 100, toNext: 100 - (points % 100) };
}

/**
 * Forgiving streak: counts days with points, going back from today.
 * One missed day is forgiven (the streak continues, that day just isn't counted).
 * Two missed days in a row end it. An unfinished today never breaks it.
 */
export function forgivingStreak(pointDays: Set<string>, today: string): number {
  let streak = 0;
  let missedInARow = 0;
  let key = today;
  if (!pointDays.has(key)) key = shiftKey(key, -1); // today isn't over yet
  for (let i = 0; i < 400; i++) {
    if (pointDays.has(key)) {
      streak++;
      missedInARow = 0;
    } else {
      missedInARow++;
      if (missedInARow >= 2) break;
    }
    key = shiftKey(key, -1);
  }
  return streak;
}

/** Same lesson/tip all day, a different one tomorrow. */
export function pickForDay<T>(items: T[], key: string): T {
  const n = key.split("-").reduce((s, part) => s + Number(part), 0);
  return items[n % items.length];
}
