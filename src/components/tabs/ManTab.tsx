"use client";

// "Man": Home and Progress in one place.
// Top: his course (Step 48), then what to do today (all interactive right here). Bottom: his trends.
// On a computer the cards sit in two columns.

import TopBar from "@/components/feed/TopBar";
import ActivitiesCard from "@/components/feed/ActivitiesCard";
import TrendsSection from "@/components/feed/TrendsSection";
import { EndCard, LessonCard, ReminderCard, TipCard, TodayCard } from "@/components/feed/FeedCards";
import { useHomeFeed } from "@/components/feed/useHomeFeed";
import CheckInCard from "@/components/progress/CheckInCard";
import CourseCard from "@/components/course/CourseCard";
import HydrationCard from "@/components/progress/HydrationCard";
import SleepCard from "@/components/progress/SleepCard";
import { useT } from "@/lib/i18n";

export default function ManTab() {
  const f = useHomeFeed();
  const t = useT();

  if (!f.ready) {
    return (
      <div className="space-y-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0">
        <div className="lg:col-span-12">
          <TopBar />
        </div>
        <div className="h-40 animate-pulse rounded-3xl bg-forest-deep/20 lg:col-span-7" />
        <div className="h-64 animate-pulse rounded-3xl bg-surface ring-1 ring-line lg:col-span-5" />
      </div>
    );
  }

  // Phone: one column, in this order. Computer (lg): today's actions on the left, the three trackers
  // on the right, trends across the bottom. The `order-*` classes keep the phone order the same.
  return (
    <div className="stagger flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:gap-6">
      <div className="lg:col-span-12">
        <TopBar />
      </div>

      {/* The course comes first, across the full width on a computer */}
      <div className="lg:col-span-12 empty:hidden">
        <CourseCard />
      </div>

      <div className="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-5">
        <div className="order-1">
          <TodayCard f={f} />
        </div>
        <div className="order-2">{f.allClosed ? <EndCard /> : <ReminderCard f={f} />}</div>
        <div className="order-6">
          <ActivitiesCard f={f} />
        </div>
        <div className="order-7">
          <LessonCard f={f} />
        </div>
        <div className="order-8">
          <TipCard f={f} />
        </div>
      </div>

      <div className="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-5">
        <div id="checkin" className="order-3 scroll-mt-4">
          <CheckInCard period={1} />
        </div>
        <div id="sleep" className="order-4 scroll-mt-4">
          <SleepCard period={1} />
        </div>
        <div id="water" className="order-5 scroll-mt-4">
          <HydrationCard period={1} />
        </div>
      </div>

      <div className="order-9 pt-4 lg:col-span-12 lg:pt-2">
        <TrendsSection />
      </div>

      <p className="order-10 px-2 pt-2 text-center text-[11px] text-ink-soft lg:col-span-12">{t("Saved privately to your account.")}</p>
    </div>
  );
}
