// Badges on the Me tab. Earned only from what he actually did — nothing is given for free,
// and nothing is earned for sharing sensitive details or for buying anything.
// Pure functions, easy to test.

import { dayLatest, dayTotal } from "../progress/calc";
import type { Goal, TrackingRecord } from "../progress/types";
import type { FeedDB } from "../feed/store";
import { forgivingStreak } from "../feed/engine";

export interface BadgeInput {
  records: TrackingRecord[];
  goals: Goal[];
  feed: FeedDB;
  points: number;
  /** Days on which he earned points (for streaks). */
  pointDays: Set<string>;
  bookmarks: number;
  posts: number;
  replies: number;
}

export interface Badge {
  id: string;
  title: string;
  titleSw: string;
  how: string;
  emoji: string;
  current: number;
  target: number;
  earned: boolean;
}

const uniqueDays = (records: TrackingRecord[], metric: TrackingRecord["metric"]) =>
  [...new Set(records.filter((r) => r.metric === metric).map((r) => r.localDate))];

/** Longest forgiving streak ever (one missed day forgiven, two end it). */
export function bestStreak(pointDays: Set<string>): number {
  let best = 0;
  for (const day of pointDays) best = Math.max(best, forgivingStreak(pointDays, day));
  return best;
}

export function computeBadges(i: BadgeInput): Badge[] {
  const waterGoal = i.goals.find((g) => g.metric === "water")?.target ?? null;
  const waterGoalDays = waterGoal
    ? uniqueDays(i.records, "water").filter((k) => (dayTotal(i.records, "water", k) ?? 0) >= waterGoal).length
    : 0;
  const sleepNights = uniqueDays(i.records, "sleep").filter((k) => dayLatest(i.records, "sleep", k)).length;
  const checkInDays = new Set([...uniqueDays(i.records, "energy"), ...uniqueDays(i.records, "mood")]).size;
  const lessons = Object.keys(i.feed.lessons).length;
  const best = bestStreak(i.pointDays);
  const level = Math.floor(i.points / 100) + 1;
  const finished = Object.values(i.feed.challenges ?? {}).filter((c) => c?.finished).length;

  const list: Omit<Badge, "earned">[] = [
    { id: "first-step", emoji: "👣", title: "First step", titleSw: "Hatua ya kwanza", how: "Earn your first points.", current: Math.min(i.points, 1), target: 1 },
    { id: "know-yourself", emoji: "🧭", title: "Know yourself", titleSw: "Jitambue", how: "Do the energy and mood check-in on 3 days.", current: checkInDays, target: 3 },
    { id: "hydration-hero", emoji: "💧", title: "Hydration hero", titleSw: "Shujaa wa maji", how: "Reach your water goal on 5 days.", current: waterGoalDays, target: 5 },
    { id: "sleep-tracker", emoji: "🌙", title: "Sleep tracker", titleSw: "Mfuatiliaji wa usingizi", how: "Log your sleep on 7 nights.", current: sleepNights, target: 7 },
    { id: "curious-mind", emoji: "📖", title: "Curious mind", titleSw: "Akili ya kudadisi", how: "Read 5 lessons.", current: lessons, target: 5 },
    { id: "steady-week", emoji: "🔥", title: "Steady week", titleSw: "Wiki imara", how: "Keep a 7-day streak. One missed day is forgiven.", current: best, target: 7 },
    { id: "rising", emoji: "⭐", title: "Rising", titleSw: "Unapanda", how: "Reach level 3.", current: level, target: 3 },
    { id: "finisher", emoji: "🏁", title: "Finisher", titleSw: "Mmalizaji", how: "Finish a Discover challenge (do it every day it asks).", current: finished, target: 1 },
    { id: "collector", emoji: "🔖", title: "Collector", titleSw: "Mkusanyaji", how: "Save 3 guides or answers.", current: i.bookmarks, target: 3 },
    { id: "your-voice", emoji: "💬", title: "Your voice", titleSw: "Sauti yako", how: "Ask a question or reply in Community.", current: Math.min(i.posts + i.replies, 1), target: 1 },
  ];
  return list.map((b) => ({ ...b, current: Math.min(b.current, b.target), earned: b.current >= b.target }));
}

/** First day he did anything in the app (YYYY-MM-DD), or null if he's new. */
export function firstActiveDay(i: Pick<BadgeInput, "records" | "feed">): string | null {
  const days = [
    ...i.records.map((r) => r.localDate),
    ...Object.keys(i.feed.days),
    ...Object.values(i.feed.lessons).map((l) => l.localDate),
  ].sort();
  return days[0] ?? null;
}
