"use client";

import { useState } from "react";
import { Moon, Footprints, Utensils, Smile, Ruler, ListChecks, Lock } from "lucide-react";
import HydrationCard, { type Period } from "@/components/progress/HydrationCard";

const PERIODS: { value: Period; label: string }[] = [
  { value: 1, label: "Today" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

// Trackers we will add next, one step at a time. Shown honestly as "not set up yet".
const UPCOMING = [
  { label: "Sleep", Icon: Moon },
  { label: "Steps and workouts", Icon: Footprints },
  { label: "Food (photo + AI estimate)", Icon: Utensils },
  { label: "Energy and mood", Icon: Smile },
  { label: "Weight and waist", Icon: Ruler },
  { label: "Habits", Icon: ListChecks },
  { label: "Private wellness", Icon: Lock },
];

export default function ProgressPage() {
  const [period, setPeriod] = useState<Period>(1);
  const todayLabel = new Date().toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="stagger space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Progress</h1>
        <p className="mt-1 text-sm text-ink-soft" suppressHydrationWarning>
          {todayLabel}
        </p>
      </div>

      {/* Period filter */}
      <div className="flex rounded-full bg-surface p-1 ring-1 ring-line" role="tablist" aria-label="Period">
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
            {p.label}
          </button>
        ))}
      </div>

      {/* Real trackers */}
      <HydrationCard period={period} />

      {/* Coming next */}
      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
        <p className="font-semibold">More trackers</p>
        <p className="text-xs text-ink-soft">Being added step by step</p>
        <ul className="mt-3 divide-y divide-line">
          {UPCOMING.map(({ label, Icon }) => (
            <li key={label} className="flex items-center justify-between py-2.5 text-sm">
              <span className="flex items-center gap-3">
                <Icon size={16} className="text-ink-soft" />
                {label}
              </span>
              <span className="text-[11px] text-ink-soft">Not set up yet</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="px-2 text-center text-[11px] text-ink-soft">
        Saved on this phone for now. Your records move to your account when you sign up.
      </p>
    </div>
  );
}
