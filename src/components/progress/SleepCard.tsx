"use client";

import { useState } from "react";
import { Moon, Pencil } from "lucide-react";
import ProgressBar from "./ProgressBar";
import DayBars from "./DayBars";
import StatusBadge from "./StatusBadge";
import FoldCard from "@/components/motion/FoldCard";
import Sheet from "@/components/motion/Sheet";
import { useToast } from "@/components/motion/Toast";
import { goalFor, progressStore, useProgress } from "@/lib/progress/store";
import { dateKey, lastNDays } from "@/lib/progress/dates";
import { averageRecorded, dayLatest, dayLatestValues, daysGoalMet, metricStatus, sleepMinutes, targetProgress } from "@/lib/progress/calc";
import { duration, RATING_LABELS, score } from "@/lib/progress/format";
import type { Period } from "@/lib/progress/types";
import { useT } from "@/lib/i18n";

type Mode = "log" | "goal" | null;

export default function SleepCard({ period }: { period: Period }) {
  const { records, goals, ready } = useProgress();
  const showToast = useToast();
  const t = useT();
  const [mode, setMode] = useState<Mode>(null);
  const [bed, setBed] = useState("22:30");
  const [wake, setWake] = useState("06:30");
  const [quality, setQuality] = useState<number | null>(null);
  const [goalHours, setGoalHours] = useState("");
  const [error, setError] = useState("");

  const goal = goalFor(goals, "sleep")?.target ?? null;
  const today = dateKey(new Date());
  const lastNight = dayLatest(records, "sleep", today);
  const lastValue = lastNight?.value ?? null;
  const status = metricStatus(lastValue, goal);
  const pct = targetProgress(lastValue, goal);

  const keys = lastNDays(period === 1 ? 7 : period);
  const values = dayLatestValues(records, "sleep", keys);
  const recorded = values.filter((v) => v !== null).length;
  const avg = averageRecorded(values);
  const met = daysGoalMet(values, goal);
  const qualities = keys.map((k) => dayLatest(records, "sleep", k)?.meta?.quality ?? null);
  const avgQuality = averageRecorded(qualities);

  const preview = sleepMinutes(bed, wake);

  function openLog() {
    setError("");
    setBed(lastNight?.meta?.bedtime ?? "22:30");
    setWake(lastNight?.meta?.wakeTime ?? "06:30");
    setQuality(lastNight?.meta?.quality ?? null);
    setMode("log");
  }

  function openGoal() {
    setError("");
    setGoalHours(goal ? String(goal / 60) : "");
    setMode("goal");
  }

  function saveLog() {
    const mins = sleepMinutes(bed, wake);
    if (mins === null) return setError(t("Choose a bedtime and a wake-up time."));
    if (mins < 60 || mins > 960) return setError(t("That's under 1 hour or over 16 hours. Check the times."));
    const meta = {
      bedtime: bed,
      wakeTime: wake,
      quality: quality ?? undefined,
    };
    if (lastNight) {
      progressStore.updateRecord(lastNight.id, mins, meta);
      showToast(t("Sleep updated"));
    } else {
      progressStore.addRecord({
        metric: "sleep",
        value: mins,
        unit: "min",
        source: "manual",
        meta,
      });
      showToast(t("{time} of sleep logged", { time: duration(mins) }));
    }
    setMode(null);
  }

  function saveGoal() {
    const h = Number(goalHours);
    if (!goalHours.trim() || !Number.isFinite(h) || h < 3 || h > 12) return setError(t("Enter hours between 3 and 12, like 7.5"));
    progressStore.setGoal("sleep", h * 60, "min");
    showToast(t("Sleep goal set to {time}", { time: duration(h * 60) }));
    setMode(null);
  }

  function remove() {
    if (!lastNight) return;
    progressStore.deleteRecord(lastNight.id);
    setMode(null);
    showToast(t("Sleep entry removed"));
  }

  if (!ready) return <div className="h-56 animate-pulse rounded-3xl bg-surface ring-1 ring-line" />;

  const head = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint text-forest">
          <Moon size={18} />
        </span>
        <div>
          <p className="font-semibold">{t("Sleep")}</p>
          <button onClick={openGoal} className="flex items-center gap-1 text-xs text-ink-soft">
            {t("Goal")} {goal ? duration(goal) : t("not set")} <Pencil size={11} />
          </button>
        </div>
      </div>
      <StatusBadge status={status} />
    </div>
  );

  // Today (Man tab): what he did last night and the log button
  const lastNightView = (
    <>
      <p className="text-xs font-medium text-ink-soft">{t("Last night")}</p>
      <p className="text-3xl font-bold">
        {lastValue === null ? <span className="text-ink-soft">—</span> : duration(lastValue)}
        <span className="text-base font-medium text-ink-soft"> / {goal ? duration(goal) : "—"}</span>
      </p>
      <div className="mt-3">
        <ProgressBar percent={pct} status={status} label={t("Sleep last night")} />
      </div>
      {lastNight ? (
        <p className="mt-2 text-xs text-ink-soft">
          {lastNight.meta?.bedtime} → {lastNight.meta?.wakeTime}
          {lastNight.meta?.quality ? ` · ${t("Quality")}: ${t(RATING_LABELS[lastNight.meta.quality - 1])}` : ""}
        </p>
      ) : (
        <p className="mt-2 text-xs text-ink-soft">{t("Not logged yet for last night.")}</p>
      )}
      <button
        onClick={openLog}
        className="mt-4 w-full rounded-full bg-forest py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
      >
        {t(lastNight ? "Edit last night" : "Log last night")}
      </button>
    </>
  );

  return (
    <>
      {period === 1 ? (
        <FoldCard
          id="sleep"
          head={head}
          description={t("Log when you went to bed and woke up, and how well you slept.")}
          peek={lastValue === null ? null : `${t("Last night")}: ${duration(lastValue)}${goal ? ` / ${duration(goal)}` : ""}`}
        >
          {lastNightView}
        </FoldCard>
      ) : (
        <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
          {head}
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Stat label={t("Average")} value={avg === null ? "—" : duration(avg)} hint={t("recorded nights")} />
            <Stat label={t("Goal reached")} value={`${met}`} hint={t("of {n} nights", { n: recorded })} />
            <Stat label={t("Quality")} value={avgQuality === null ? "—" : `${score(avgQuality)}/5`} hint={t("average")} />
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-3 text-xs font-medium text-ink-soft">{t("Last {n} nights", { n: period })}</p>
            <DayBars keys={keys} values={values} target={goal} format={duration} />
          </div>
        </section>
      )}

      <Sheet open={mode !== null} onClose={() => setMode(null)} title={t(mode === "goal" ? "Sleep goal" : "Last night's sleep")}>
        {mode === "goal" ? (
          <>
            <label htmlFor="sleep-goal" className="text-xs text-ink-soft">
              {t("Hours per night")}
            </label>
            <input
              id="sleep-goal"
              autoFocus
              inputMode="decimal"
              value={goalHours}
              onChange={(e) => {
                setGoalHours(e.target.value.replace(/[^\d.]/g, ""));
                setError("");
              }}
              placeholder="7"
              className={`mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none ring-1 focus:ring-2 ${error ? "ring-red-500" : "ring-line focus:ring-forest"}`}
            />
            <p className="mt-2 text-xs text-ink-soft">{t("Most adults do well with 7–9 hours. Choose what suits you.")}</p>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-ink-soft">
                {t("Went to bed")}
                <input
                  type="time"
                  value={bed}
                  onChange={(e) => {
                    setBed(e.target.value);
                    setError("");
                  }}
                  className="mt-1 w-full rounded-2xl px-3 py-3 text-sm text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-forest"
                />
              </label>
              <label className="text-xs text-ink-soft">
                {t("Woke up")}
                <input
                  type="time"
                  value={wake}
                  onChange={(e) => {
                    setWake(e.target.value);
                    setError("");
                  }}
                  className="mt-1 w-full rounded-2xl px-3 py-3 text-sm text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-forest"
                />
              </label>
            </div>
            <p className="mt-2 text-sm font-semibold text-forest">{preview ? t("{time} of sleep", { time: duration(preview) }) : "—"}</p>
            <p className="mt-4 text-xs text-ink-soft">{t("How well did you sleep? (optional)")}</p>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {RATING_LABELS.map((label, i) => (
                <button
                  key={label}
                  onClick={() => setQuality(quality === i + 1 ? null : i + 1)}
                  className={`rounded-xl py-2 text-[10px] font-semibold transition-colors ${
                    quality === i + 1 ? "bg-forest text-white" : "ring-1 ring-line"
                  }`}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-5 flex items-center justify-between gap-2">
          {mode === "log" && lastNight ? (
            <button onClick={remove} className="text-sm font-semibold text-red-600">
              {t("Delete")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={() => setMode(null)} className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-line">
              {t("Cancel")}
            </button>
            <button
              onClick={mode === "goal" ? saveGoal : saveLog}
              className="rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white"
            >
              {t("Save")}
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
