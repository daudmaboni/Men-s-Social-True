"use client";

import { Smile } from "lucide-react";
import DayBars from "./DayBars";
import StatusBadge from "./StatusBadge";
import { useToast } from "@/components/motion/Toast";
import { progressStore, useProgress } from "@/lib/progress/store";
import { dateKey, lastNDays, shiftKey } from "@/lib/progress/dates";
import { averageRecorded, dayLatest, dayLatestValues, periodChange } from "@/lib/progress/calc";
import { RATING_LABELS, score, signed } from "@/lib/progress/format";
import type { Period } from "@/lib/progress/types";

const QUESTIONS = [
  { metric: "energy", title: "Energy", ask: "How is your energy today?" },
  { metric: "mood", title: "Mood", ask: "How is your mood today?" },
] as const;

export default function CheckInCard({ period }: { period: Period }) {
  const { records, ready } = useProgress();
  const showToast = useToast();
  const today = dateKey(new Date());

  const answered = QUESTIONS.filter((q) => dayLatest(records, q.metric, today)).length;
  const status = answered === 0 ? "not_recorded" : "tracked";
  const badge = answered === 0 ? "Not yet today" : answered === 2 ? "Checked in" : "1 of 2 answered";

  const days = period === 1 ? 7 : period;
  const keys = lastNDays(days);
  const prevKeys = keys.map((k) => shiftKey(k, -days));

  function answer(metric: "energy" | "mood", value: number) {
    progressStore.setDailyValue({ metric, value, unit: "score", source: "manual" });
    showToast(`${metric === "energy" ? "Energy" : "Mood"}: ${RATING_LABELS[value - 1]}`);
  }

  if (!ready) return <div className="h-56 animate-pulse rounded-3xl bg-surface ring-1 ring-line" />;

  return (
    <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint text-forest">
            <Smile size={18} />
          </span>
          <div>
            <p className="font-semibold">Energy and mood</p>
            <p className="text-xs text-ink-soft">Daily check-in · 1 to 5</p>
          </div>
        </div>
        <StatusBadge status={status} text={badge} />
      </div>

      {QUESTIONS.map((q) => {
        const todayValue = dayLatest(records, q.metric, today)?.value ?? null;
        const values = dayLatestValues(records, q.metric, keys);
        const avg = averageRecorded(values);
        const prevAvg = averageRecorded(dayLatestValues(records, q.metric, prevKeys));
        const change = periodChange(avg, prevAvg);
        const recorded = values.filter((v) => v !== null).length;

        return (
          <div key={q.metric} className="mt-5 border-t border-line pt-4">
            {period === 1 ? (
              <>
                <p className="text-sm font-medium">{q.ask}</p>
                <div className="mt-2 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={q.title}>
                  {RATING_LABELS.map((label, i) => {
                    const selected = todayValue === i + 1;
                    return (
                      <button
                        key={label}
                        role="radio"
                        aria-checked={selected}
                        onClick={() => answer(q.metric, i + 1)}
                        className={`flex flex-col items-center gap-0.5 rounded-xl py-2 transition-all active:scale-95 ${
                          selected ? "bg-forest text-white" : "ring-1 ring-line"
                        }`}
                      >
                        <span className="text-sm font-bold">{i + 1}</span>
                        <span className={`text-[9px] ${selected ? "text-mint" : "text-ink-soft"}`}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm font-medium">{q.title}</p>
                  <p className="text-2xl font-bold">
                    {avg === null ? <span className="text-ink-soft">—</span> : score(avg)}
                    <span className="text-sm font-medium text-ink-soft"> / 5 average</span>
                  </p>
                  <p className="text-[11px] text-ink-soft">
                    {recorded} of {days} days answered
                    {change !== null && ` · ${signed(change)} vs previous ${days} days`}
                  </p>
                </div>
              </div>
            )}
            {period !== 1 && (
              <div className="mt-3">
                <DayBars keys={keys} values={values} target={null} scaleMax={5} format={(v) => `${v}/5`} compact />
              </div>
            )}
          </div>
        );
      })}

      <p className="mt-4 text-[11px] text-ink-soft">
        These are your own ratings. They help you notice patterns over time — they are not a medical measurement.
      </p>
    </section>
  );
}
