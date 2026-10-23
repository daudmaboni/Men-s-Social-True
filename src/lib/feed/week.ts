// His week in review (Step 79): shown on the Man tab on Sundays and Mondays (and when the Sunday
// reminder opens /man?week=1). Only what he recorded himself; nothing is a health score.
//  - Sunday: this week so far (Monday to today)
//  - Monday: last week (Monday to Sunday)
// Days with nothing recorded are left out of the averages (never counted as zero).

import type { FeedDB } from "./store";
import type { TrackingRecord } from "../progress/types";
import { shiftKey } from "../progress/dates";

export type WeekSummary = {
  from: string;
  to: string;
  daysActive: number;
  activitiesDone: number;
  lessons: number;
  cardsDone: number;
  points: number;
  /** Average sleep per recorded night (minutes), or null. */
  sleepAvg: number | null;
  sleepNights: number;
  /** Average water per recorded day (ml), or null. */
  waterAvg: number | null;
  waterDays: number;
};

/** Monday-to-Sunday keys of the week to show, given today's key and weekday (1 = Monday … 7 = Sunday). */
export function weekKeys(today: string, isoWeekday: number): string[] {
  const end = isoWeekday === 7 ? today : shiftKey(today, -isoWeekday); // Mon..Sat → last Sunday
  return Array.from({ length: 7 }, (_, i) => shiftKey(end, i - 6)).filter((k) => k <= today);
}

/** Is today a day to show the week? (Sunday, Monday, or the reminder asked for it.) */
export function showWeek(isoWeekday: number, asked = false): boolean {
  return asked || isoWeekday === 7 || isoWeekday === 1;
}

export function summarizeWeek(keys: string[], feed: FeedDB, records: TrackingRecord[], pointsOn: (key: string) => number): WeekSummary {
  const inWeek = new Set(keys);
  const active = new Set<string>();
  let activitiesDone = 0;
  for (const k of keys) {
    const day = feed.days[k] ?? {};
    const done = Object.values(day).filter((c) => c?.status === "done").length;
    activitiesDone += done;
    if (Object.keys(day).length) active.add(k);
  }
  let lessons = 0;
  const count = (localDate: string | undefined) => {
    if (!localDate || !inWeek.has(localDate)) return 0;
    active.add(localDate);
    return 1;
  };
  for (const l of Object.values(feed.lessons)) lessons += count(l.localDate);
  for (const c of Object.values(feed.course ?? {})) lessons += count(c.done?.localDate);
  let cardsDone = 0;
  for (const x of Object.values(feed.tried ?? {})) cardsDone += count(x?.localDate);

  const sleepByDay = new Map<string, number>();
  const waterByDay = new Map<string, number>();
  for (const r of records) {
    if (!inWeek.has(r.localDate)) continue;
    active.add(r.localDate);
    if (r.metric === "sleep") sleepByDay.set(r.localDate, Math.max(sleepByDay.get(r.localDate) ?? 0, r.value));
    if (r.metric === "water") waterByDay.set(r.localDate, (waterByDay.get(r.localDate) ?? 0) + r.value);
  }
  const avg = (m: Map<string, number>) => (m.size ? Math.round([...m.values()].reduce((a, b) => a + b, 0) / m.size) : null);
  return {
    from: keys[0],
    to: keys[keys.length - 1],
    daysActive: active.size,
    activitiesDone,
    lessons,
    cardsDone,
    points: keys.reduce((s, k) => s + pointsOn(k), 0),
    sleepAvg: avg(sleepByDay),
    sleepNights: sleepByDay.size,
    waterAvg: avg(waterByDay),
    waterDays: waterByDay.size,
  };
}

/** One thing to try next week, from what's missing (never a judgement, just a next step). */
export function nextWeekTip(w: WeekSummary, goals: { sleepMin: number | null; waterMl: number | null }): string {
  if (w.daysActive <= 2) return "Open the app for one small thing each day. Five days in a row is the goal.";
  if (w.sleepNights < 3) return "Record your sleep on more nights, so you can see your pattern.";
  if (goals.sleepMin && w.sleepAvg !== null && w.sleepAvg < goals.sleepMin - 30) return "Go to bed 30 minutes earlier on three nights this week.";
  if (w.waterDays < 3) return "Log your water on more days. Start with a glass when you wake up.";
  if (goals.waterMl && w.waterAvg !== null && w.waterAvg < goals.waterMl * 0.8) return "Add one more glass of water each day.";
  if (w.cardsDone === 0) return "Try one card from Discover and tap \"I did it\".";
  if (w.lessons === 0) return "Listen to one lesson of the course this week.";
  return "Keep the same rhythm. You're doing well.";
}
