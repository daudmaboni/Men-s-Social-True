"use client";

import { useState } from "react";
import { LineChart } from "lucide-react";
import FoldCard from "@/components/motion/FoldCard";
import CheckInCard from "@/components/progress/CheckInCard";
import HydrationCard from "@/components/progress/HydrationCard";
import SleepCard from "@/components/progress/SleepCard";
import type { Period } from "@/lib/progress/types";
import { useT } from "@/lib/i18n";

const METRICS = [
  { id: "mood", label: "Energy & mood" },
  { id: "water", label: "Water" },
  { id: "sleep", label: "Sleep" },
] as const;

const PERIODS: { value: Exclude<Period, 1>; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

/** One place for all charts: pick what to look at and over how long. */
export default function TrendsSection() {
  const [metric, setMetric] = useState<(typeof METRICS)[number]["id"]>("mood");
  const [period, setPeriod] = useState<Exclude<Period, 1>>(7);
  const t = useT();

  // Folded until he taps it (Step 51): the charts are there when he wants them
  return (
    <FoldCard
      id="trends"
      head={
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint text-forest">
            <LineChart size={18} />
          </span>
          <h2 className="text-lg font-bold">{t("Your trends")}</h2>
        </div>
      }
      description={t("Your energy, mood, water and sleep over 7, 30 or 90 days. Built only from what you have logged.")}
    >
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={t("What to show")}>
          {METRICS.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={metric === m.id}
              onClick={() => setMetric(m.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                metric === m.id ? "bg-forest-deep text-white" : "bg-surface text-ink-soft ring-1 ring-line"
              }`}
            >
              {t(m.label)}
            </button>
          ))}
        </div>

        <div className="flex rounded-full bg-surface p-1 ring-1 ring-line" role="tablist" aria-label={t("Period")}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              role="tab"
              aria-selected={period === p.value}
              onClick={() => setPeriod(p.value)}
              className={`flex-1 rounded-full py-2 text-xs font-semibold transition-colors ${
                period === p.value ? "bg-forest text-white" : "text-ink-soft"
              }`}
            >
              {t(p.label)}
            </button>
          ))}
        </div>

        <div key={`${metric}-${period}`} className="page-enter trend-inner">
          {metric === "mood" && <CheckInCard period={period} />}
          {metric === "water" && <HydrationCard period={period} />}
          {metric === "sleep" && <SleepCard period={period} />}
        </div>
      </div>
    </FoldCard>
  );
}
