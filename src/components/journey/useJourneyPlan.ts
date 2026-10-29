"use client";

import { useMemo } from "react";
import { ACTIVITIES } from "@/lib/feed/catalog";
import { activityStatus } from "@/lib/feed/engine";
import { useFeed } from "@/lib/feed/store";
import { buildPlan } from "@/lib/journey/engine";
import { useJourney } from "@/lib/journey/store";
import type { TaskDef } from "@/lib/journey/tasks";
import { dateKey } from "@/lib/progress/dates";
import { useProgress } from "@/lib/progress/store";

/**
 * Step 100: his plan for today, worked out from his answers and his real records.
 * Tasks shared with the Man tab (walk, breathing, check-in, sleep, water, screens off) read the same
 * records the Man tab uses, so one tick shows in both places.
 */
export function useJourneyPlan() {
  const journey = useJourney();
  const feed = useFeed();
  const progress = useProgress();
  const ready = journey.ready && feed.ready && progress.ready;
  const today = dateKey(new Date());

  const plan = useMemo(() => {
    if (!ready) return null;
    const isDone = (task: TaskDef, day: string) => {
      if (task.activity) {
        const a = ACTIVITIES.find((x) => x.id === task.activity);
        return a ? activityStatus(a, feed, progress.records, progress.goals, day) === "done" : false;
      }
      return Boolean(journey.done?.[day]?.[task.id]);
    };
    return buildPlan({ db: journey, today, isDone });
  }, [ready, journey, feed, progress.records, progress.goals, today]);

  return { ready, journey, plan, today, discreet: feed.settings.discreet };
}
