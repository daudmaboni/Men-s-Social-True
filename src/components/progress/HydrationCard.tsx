"use client";

import { useState } from "react";
import { Droplet, GlassWater, Milk, Plus, Pencil } from "lucide-react";
import ProgressBar from "./ProgressBar";
import DayBars from "./DayBars";
import StatusBadge from "./StatusBadge";
import Sheet from "@/components/motion/Sheet";
import { useToast } from "@/components/motion/Toast";
import { goalFor, progressStore, useProgress } from "@/lib/progress/store";
import { dateKey, lastNDays } from "@/lib/progress/dates";
import {
  averageRecorded,
  dayTotal,
  dayTotals,
  daysGoalMet,
  goalStreak,
  metricStatus,
  targetProgress,
} from "@/lib/progress/calc";
import { litres } from "@/lib/progress/format";
import type { Period, RecordSource, TrackingRecord } from "@/lib/progress/types";

const QUICK = [
  { ml: 250, label: "Glass", Icon: GlassWater },
  { ml: 500, label: "Bottle", Icon: Milk },
];

const SOURCE_LABEL: Record<RecordSource, string> = {
  manual: "Entered",
  quick_add: "Quick add",
  ai_estimate: "AI estimate",
  device_sync: "Synced",
  calculated: "Calculated",
};

type SheetMode = { kind: "custom" } | { kind: "edit"; record: TrackingRecord } | { kind: "goal" } | null;

export default function HydrationCard({ period }: { period: Period }) {
  const { records, goals, ready } = useProgress();
  const showToast = useToast();
  const [sheet, setSheet] = useState<SheetMode>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const goal = goalFor(goals, "water")?.target ?? null;
  const today = dateKey(new Date());
  const todayTotal = dayTotal(records, "water", today);
  const status = metricStatus(todayTotal, goal);
  const pct = targetProgress(todayTotal, goal);

  const keys = lastNDays(period === 1 ? 7 : period);
  const totals = dayTotals(records, "water", keys);
  const recordedDays = totals.filter((v) => v !== null).length;
  const avg = averageRecorded(totals);
  const met = daysGoalMet(totals, goal);
  const streak = goalStreak(dayTotals(records, "water", lastNDays(90)), goal);

  const todayEntries = records
    .filter((r) => r.metric === "water" && r.localDate === today)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  function quickAdd(ml: number) {
    progressStore.addRecord({ metric: "water", value: ml, unit: "ml", source: "quick_add" });
    showToast(`+${ml} ml water logged`);
  }

  function openSheet(mode: SheetMode) {
    setError("");
    setInput(
      mode?.kind === "edit" ? String(mode.record.value) : mode?.kind === "goal" && goal ? String(goal) : "",
    );
    setSheet(mode);
  }

  function submit() {
    const n = Number(input);
    const max = sheet?.kind === "goal" ? 10000 : 5000;
    if (!input.trim() || !Number.isFinite(n) || n <= 0) return setError("Enter an amount in ml, like 300");
    if (n > max) return setError(`That's more than ${litres(max)}. Check the amount.`);
    if (sheet?.kind === "custom") {
      progressStore.addRecord({ metric: "water", value: n, unit: "ml", source: "manual" });
      showToast(`+${Math.round(n)} ml water logged`);
    } else if (sheet?.kind === "edit") {
      progressStore.updateRecord(sheet.record.id, n);
      showToast("Entry updated");
    } else if (sheet?.kind === "goal") {
      progressStore.setGoal("water", n, "ml");
      showToast(`Daily goal set to ${litres(n)}`);
    }
    setSheet(null);
  }

  function remove(record: TrackingRecord) {
    progressStore.deleteRecord(record.id);
    setSheet(null);
    showToast(`Removed ${record.value} ml`);
  }

  if (!ready) {
    return <div className="h-64 animate-pulse rounded-3xl bg-surface ring-1 ring-line" />;
  }

  return (
    <>
      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint text-forest">
              <Droplet size={18} />
            </span>
            <div>
              <p className="font-semibold">Water</p>
              <button onClick={() => openSheet({ kind: "goal" })} className="flex items-center gap-1 text-xs text-ink-soft">
                Daily goal {goal ? litres(goal) : "not set"} <Pencil size={11} />
              </button>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {period === 1 ? (
          <>
            {/* Today */}
            <p className="mt-5 text-3xl font-bold">
              {todayTotal === null ? (
                <span className="text-ink-soft">—</span>
              ) : (
                litres(todayTotal)
              )}
              <span className="text-base font-medium text-ink-soft"> / {goal ? litres(goal) : "—"}</span>
            </p>
            <div className="mt-3">
              <ProgressBar percent={pct} status={status} label="Water today" />
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              {status === "not_recorded"
                ? "Nothing recorded yet today."
                : status === "goal_achieved"
                  ? "Goal reached today. Well done."
                  : `${Math.round(pct ?? 0)}% · ${litres(Math.max((goal ?? 0) - (todayTotal ?? 0), 0))} to go`}
            </p>

            {/* Quick add */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {QUICK.map(({ ml, label, Icon }) => (
                <button
                  key={ml}
                  onClick={() => quickAdd(ml)}
                  className="flex flex-col items-center gap-1 rounded-2xl bg-mint/60 py-3 text-forest transition-transform active:scale-[0.96]"
                >
                  <Icon size={18} />
                  <span className="text-xs font-semibold">+{ml} ml</span>
                  <span className="text-[10px] text-ink-soft">{label}</span>
                </button>
              ))}
              <button
                onClick={() => openSheet({ kind: "custom" })}
                className="flex flex-col items-center gap-1 rounded-2xl py-3 ring-1 ring-line transition-transform active:scale-[0.96]"
              >
                <Plus size={18} />
                <span className="text-xs font-semibold">Custom</span>
                <span className="text-[10px] text-ink-soft">Any amount</span>
              </button>
            </div>

            {/* Today's entries */}
            {todayEntries.length > 0 && (
              <ul className="mt-4 divide-y divide-line border-t border-line">
                {todayEntries.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => openSheet({ kind: "edit", record: r })}
                      className="flex w-full items-center justify-between py-2.5 text-left text-sm"
                    >
                      <span>
                        {r.value} ml
                        <span className="ml-2 text-[11px] text-ink-soft">{SOURCE_LABEL[r.source]}</span>
                      </span>
                      <span className="text-xs text-ink-soft">
                        {new Date(r.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            {/* Period summary */}
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <Stat label="Daily average" value={avg === null ? "—" : litres(Math.round(avg))} hint="recorded days" />
              <Stat label="Goal reached" value={`${met}`} hint={`of ${recordedDays} recorded`} />
              <Stat label="Streak" value={`${streak}`} hint={streak === 1 ? "day" : "days"} />
            </div>
            {recordedDays === 0 && (
              <p className="mt-3 text-xs text-ink-soft">No water recorded in the last {period} days.</p>
            )}
          </>
        )}

        {/* Chart */}
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-3 text-xs font-medium text-ink-soft">
            {period === 1 ? "Last 7 days" : `Last ${period} days`}
          </p>
          <DayBars keys={keys} values={totals} target={goal} format={litres} />
        </div>
      </section>

      {/* Add / edit / goal sheet */}
      <Sheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet?.kind === "goal" ? "Daily water goal" : sheet?.kind === "edit" ? "Edit entry" : "Add water"}
      >
        <label htmlFor="water-ml" className="text-xs text-ink-soft">
          Amount in ml
        </label>
        <input
          id="water-ml"
          autoFocus
          inputMode="numeric"
          value={input}
          onChange={(e) => {
            setInput(e.target.value.replace(/[^\d.]/g, ""));
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={sheet?.kind === "goal" ? "2500" : "300"}
          className={`mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none ring-1 focus:ring-2 ${
            error ? "ring-red-500 focus:ring-red-500" : "ring-line focus:ring-forest"
          }`}
        />
        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
        {sheet?.kind === "goal" && (
          <p className="mt-2 text-xs text-ink-soft">A common starting point is 2,000–3,000 ml. Choose what suits you.</p>
        )}
        <div className="mt-5 flex items-center justify-between gap-2">
          {sheet?.kind === "edit" ? (
            <button onClick={() => remove(sheet.record)} className="text-sm font-semibold text-red-600">
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={() => setSheet(null)} className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-line">
              Cancel
            </button>
            <button onClick={submit} className="rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white">
              Save
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl bg-bg p-3">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[11px] font-medium">{label}</p>
      <p className="text-[10px] text-ink-soft">{hint}</p>
    </div>
  );
}
