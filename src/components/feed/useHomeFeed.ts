"use client";

import { ACTIVITIES, LESSONS, TIPS } from "@/lib/feed/catalog";
import {
  activeDays,
  activityStatus,
  dayPoints,
  forgivingStreak,
  greeting,
  levelFor,
  orderForSlot,
  pickForDay,
  timeSlot,
  totalPoints,
  type ActivityStatus,
} from "@/lib/feed/engine";
import { useFeed } from "@/lib/feed/store";
import { dateKey } from "@/lib/progress/dates";
import { useProgress } from "@/lib/progress/store";

/** Everything the Home feed shows, worked out from his real records and choices. */
export function useHomeFeed() {
  const feed = useFeed();
  const progress = useProgress();
  const ready = feed.ready && progress.ready;

  const now = new Date();
  const today = dateKey(now);
  const slot = timeSlot(now);
  const { records, goals } = progress;

  const statuses: Record<string, ActivityStatus> = {};
  for (const a of ACTIVITIES) statuses[a.id] = activityStatus(a, feed, records, goals, today);

  const activities = orderForSlot(ACTIVITIES, statuses, slot);
  const doneCount = ACTIVITIES.filter((a) => statuses[a.id] === "done").length;
  const closedCount = ACTIVITIES.filter((a) => statuses[a.id] === "done" || statuses[a.id] === "skipped").length;

  const pointsToday = dayPoints(ACTIVITIES, LESSONS, feed, records, goals, today);
  const points = totalPoints(ACTIVITIES, LESSONS, feed, records, goals);
  const pointDays = new Set(
    activeDays(feed, records).filter((k) => dayPoints(ACTIVITIES, LESSONS, feed, records, goals, k) > 0),
  );
  const streak = forgivingStreak(pointDays, today);

  // The one thing to do now: first pending item that fits this time of day (or any time)
  const reminder =
    activities.find((a) => statuses[a.id] === "pending" && (a.slot === slot || a.slot === "any")) ?? null;

  return {
    ready,
    today,
    slot,
    greeting: greeting(slot),
    discreet: feed.settings.discreet,
    activities,
    statuses,
    doneCount,
    total: ACTIVITIES.length,
    allClosed: closedCount === ACTIVITIES.length,
    pointsToday,
    points,
    level: levelFor(points),
    streak,
    isNew: points === 0,
    reminder,
    lesson: pickForDay(LESSONS, today),
    lessonRead: (id: string) => Boolean(feed.lessons[id]),
    tip: pickForDay(TIPS, today),
    waterToday: records.filter((r) => r.metric === "water" && r.localDate === today).reduce((s, r) => s + r.value, 0),
    waterGoal: goals.find((g) => g.metric === "water")?.target ?? null,
  };
}

export type HomeFeed = ReturnType<typeof useHomeFeed>;
