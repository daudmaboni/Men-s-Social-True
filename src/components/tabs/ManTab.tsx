"use client";

// "Man": Home and Progress in one place.
// Top: what to do today (all interactive right here). Bottom: his trends.

import TopBar from "@/components/feed/TopBar";
import ActivitiesCard from "@/components/feed/ActivitiesCard";
import TrendsSection from "@/components/feed/TrendsSection";
import { EndCard, LessonCard, ReminderCard, TipCard, TodayCard } from "@/components/feed/FeedCards";
import { useHomeFeed } from "@/components/feed/useHomeFeed";
import CheckInCard from "@/components/progress/CheckInCard";
import HydrationCard from "@/components/progress/HydrationCard";
import SleepCard from "@/components/progress/SleepCard";
import SaveProgressCard, { WhereSavedNote } from "@/components/account/SaveProgressCard";

export default function ManTab() {
  const f = useHomeFeed();

  if (!f.ready) {
    return (
      <div className="space-y-4">
        <TopBar />
        <div className="h-40 animate-pulse rounded-3xl bg-forest-deep/20" />
        <div className="h-64 animate-pulse rounded-3xl bg-surface ring-1 ring-line" />
      </div>
    );
  }

  return (
    <div className="stagger space-y-4">
      <TopBar />
      <TodayCard f={f} />
      {f.allClosed ? <EndCard /> : <ReminderCard f={f} />}

      <div id="checkin" className="scroll-mt-4">
        <CheckInCard period={1} />
      </div>
      <div id="sleep" className="scroll-mt-4">
        <SleepCard period={1} />
      </div>
      <div id="water" className="scroll-mt-4">
        <HydrationCard period={1} />
      </div>
      <ActivitiesCard f={f} />
      <SaveProgressCard points={f.points} />

      <LessonCard f={f} />
      <TipCard f={f} />

      <div className="pt-4">
        <TrendsSection />
      </div>

      <WhereSavedNote />
    </div>
  );
}
