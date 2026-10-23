"use client";

// His week in review on the Man tab (Step 79): Sundays (this week so far) and Mondays (last week),
// or when the Sunday reminder opens /man?week=1. "Got it" puts it away until next week.

import { useEffect, useState } from "react";
import { CalendarCheck, X } from "lucide-react";
import type { HomeFeed } from "./useHomeFeed";
import { useFeed } from "@/lib/feed/store";
import { goalFor, useProgress } from "@/lib/progress/store";
import { nextWeekTip, showWeek, summarizeWeek, weekKeys } from "@/lib/feed/week";
import { duration, litres } from "@/lib/progress/format";
import { useT } from "@/lib/i18n";

const SEEN = "ms_week_seen_v1";

/** 1 = Monday … 7 = Sunday, for a "YYYY-MM-DD" key. */
const isoWeekday = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
};

export default function WeekCard({ f }: { f: HomeFeed }) {
  const t = useT();
  const feed = useFeed();
  const progress = useProgress();
  const [asked, setAsked] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);
  useEffect(() => {
    setAsked(new URLSearchParams(window.location.search).get("week") === "1");
    try {
      setSeen(localStorage.getItem(SEEN));
    } catch {}
  }, []);

  const wd = isoWeekday(f.today);
  if (!f.ready || !showWeek(wd, asked)) return null;
  const keys = weekKeys(f.today, wd);
  if (!asked && seen === keys[0]) return null;
  const w = summarizeWeek(keys, feed, progress.records, f.pointsOn);
  if (!asked && w.daysActive === 0 && w.points === 0) return null; // nothing to show yet
  const tip = nextWeekTip(w, {
    sleepMin: goalFor(progress.goals, "sleep")?.target ?? null,
    waterMl: goalFor(progress.goals, "water")?.target ?? null,
  });
  const close = () => {
    try {
      localStorage.setItem(SEEN, keys[0]);
    } catch {}
    setSeen(keys[0]);
    setAsked(false);
  };

  const stats: [string, string][] = [
    [t("Days active"), `${w.daysActive}/7`],
    [t("Points"), `+${w.points}`],
    [t("Activities done"), String(w.activitiesDone)],
    [t("Lessons"), String(w.lessons)],
    [t("Cards you did"), String(w.cardsDone)],
    [t("Sleep (average)"), w.sleepAvg === null ? "—" : duration(w.sleepAvg)],
    [t("Water (average)"), w.waterAvg === null ? "—" : litres(w.waterAvg)],
  ];

  return (
    <section className="relative rounded-3xl bg-surface p-5 ring-1 ring-line" aria-label={t("Your week")}>
      <button onClick={close} aria-label={t("Close")} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-ink-soft">
        <X size={16} />
      </button>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-forest">
        <CalendarCheck size={14} /> {wd === 7 ? t("Your week so far") : t("Your last week")}
      </p>
      <p className="mt-1 pr-8 font-display text-xl font-extrabold">
        {w.daysActive >= 5 ? t("Strong week, kaka.") : w.daysActive >= 3 ? t("Good rhythm. Keep it going.") : t("A new week is a fresh start.")}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-bg px-3 py-2 ring-1 ring-line">
            <dt className="text-[0.6875rem] text-ink-soft">{k}</dt>
            <dd className="font-display text-lg font-bold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 rounded-2xl bg-mint/60 px-3 py-2.5 text-sm text-forest-deep">
        <span className="font-semibold">{t("Next week:")}</span> {t(tip)}
      </p>
      <button onClick={close} className="mt-3 w-full rounded-full bg-forest py-2.5 text-sm font-semibold text-white">
        {t("Got it")}
      </button>
    </section>
  );
}
