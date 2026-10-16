"use client";

import { useEffect, useState } from "react";
import { Check, Moon, Pencil, Sunrise } from "lucide-react";
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
import { CATEGORY_LABEL, clockOf, sessionMinutes, sleepCategory, weekInsight, weekSummary } from "@/lib/progress/sleep";
import { sleepTracker, useSleepTracker } from "@/lib/progress/sleepTracker";
import { shiftKey } from "@/lib/progress/dates";
import { useT } from "@/lib/i18n";

type Mode = "log" | "goal" | null;
/** Times he typed in himself */
const TYPED = "manual" as const;

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
  const tracker = useSleepTracker();
  // The clock, for "sleeping for 6h 10m" and the evening/morning choice (updates every minute)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

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

  function openLog(fromNight = false) {
    setError("");
    if (fromNight && tracker.night) {
      // "I woke up earlier": the bedtime he tapped, the wake time to set
      setBed(clockOf(tracker.night.startAt));
      setWake(clockOf(now));
    } else {
      setBed(lastNight?.meta?.bedtime ?? "22:30");
      setWake(lastNight?.meta?.wakeTime ?? "06:30");
    }
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
    // The night ends this morning at the wake time (yesterday's morning if that time hasn't come yet)
    const [wh, wm] = wake.split(":").map(Number);
    const end = new Date(now);
    end.setHours(wh, wm, 0, 0);
    if (end.getTime() > now.getTime() + 5 * 60_000) end.setDate(end.getDate() - 1);
    const start = new Date(end.getTime() - mins * 60_000);
    const wasEstimate = lastNight?.meta?.status === "estimated";
    progressStore.saveNight({
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      minutes: mins,
      how: TYPED,
      status: wasEstimate ? "corrected" : "confirmed",
      quality: quality ?? undefined,
      // Keep the app's own estimate when he corrects it
      original: wasEstimate && lastNight?.meta?.startAt && lastNight.meta.endAt ? { startAt: lastNight.meta.startAt, endAt: lastNight.meta.endAt, minutes: lastNight.value } : lastNight?.meta?.original,
    });
    if (tracker.night) sleepTracker.cancelNight();
    sleepTracker.clearIncomplete();
    showToast(lastNight ? t("Sleep updated") : t("{time} of sleep logged", { time: duration(mins) }));
    setMode(null);
  }

  /** "That's right": the estimate becomes his confirmed night. */
  function confirmEstimate() {
    const m = lastNight?.meta;
    if (!lastNight || !m?.startAt || !m.endAt) return;
    progressStore.saveNight({ startAt: m.startAt, endAt: m.endAt, minutes: lastNight.value, how: m.how ?? "app_activity", status: "confirmed", quality: m.quality });
    showToast(t("Thanks. Sleep saved."));
  }

  function wakeUp() {
    const rec = sleepTracker.endNight(now);
    if (rec) showToast(t("Good morning. {time} of sleep.", { time: duration(rec.value) }));
    else {
      // Under an hour: not a night
      sleepTracker.cancelNight();
      showToast(t("That was under an hour, so it wasn't saved."));
    }
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
    sleepTracker.clearIncomplete();
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
      {tracker.night && period === 1 ? <StatusBadge status="tracked" text={t("Sleeping")} /> : <StatusBadge status={status} />}
    </div>
  );

  // ---- Today (Man tab): one of these states ----
  const hour = now.getHours();
  const evening = hour >= 19 || hour < 4;
  const sleepingFor = tracker.night ? sessionMinutes(tracker.night.startAt, now) : null;
  const how = lastNight?.meta?.how;
  const st = lastNight?.meta?.status;
  const category = sleepCategory(lastValue);
  const sourceLabel = !lastNight
    ? ""
    : st === "estimated"
      ? t("Estimated from when you used the app")
      : st === "corrected"
        ? t("Corrected by you")
        : how === "tap"
          ? t("From your taps")
          : how === "app_activity"
            ? t("Estimate you confirmed")
            : t("Entered by you");
  const primary = "w-full rounded-full bg-forest py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98]";
  const quiet = "rounded-full px-4 py-2 text-xs font-semibold ring-1 ring-line";

  const lastNightView = tracker.night ? (
    // A. Asleep (he tapped "Going to sleep")
    <>
      <p className="text-xs font-medium text-ink-soft">{t("Sleeping since {time}", { time: clockOf(tracker.night.startAt) })}</p>
      <p className="text-3xl font-bold">{sleepingFor ? duration(sleepingFor) : t("Just now")}</p>
      <button onClick={wakeUp} className={`mt-4 flex items-center justify-center gap-2 ${primary}`}>
        <Sunrise size={16} /> {t("I'm awake")}
      </button>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button onClick={() => openLog(true)} className={quiet}>
          {t("I woke up earlier")}
        </button>
        <button onClick={() => sleepTracker.cancelNight()} className={`${quiet} text-ink-soft`}>
          {t("Cancel")}
        </button>
      </div>
    </>
  ) : lastNight ? (
    // B. Last night is known
    <>
      <p className="text-xs font-medium text-ink-soft">{t("Last night")}</p>
      <p className="text-3xl font-bold">
        {duration(lastValue ?? 0)}
        <span className="text-base font-medium text-ink-soft"> / {goal ? duration(goal) : "—"}</span>
      </p>
      <div className="mt-3">
        <ProgressBar percent={pct} status={status} label={t("Sleep last night")} />
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        {lastNight.meta?.bedtime} → {lastNight.meta?.wakeTime}
        {category ? ` · ${t(CATEGORY_LABEL[category])}` : ""}
        {lastNight.meta?.quality ? ` · ${t("Quality")}: ${t(RATING_LABELS[lastNight.meta.quality - 1])}` : ""}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-forest">{sourceLabel}</p>
      {st === "estimated" ? (
        <>
          <p className="mt-2 rounded-2xl bg-bg px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
            {t("This is the time between closing the app at night and opening it in the morning. It may be longer than your real sleep.")}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={confirmEstimate} className="flex items-center justify-center gap-1.5 rounded-full bg-forest py-3 text-sm font-semibold text-white">
              <Check size={15} /> {t("That's right")}
            </button>
            <button onClick={() => openLog()} className="rounded-full py-3 text-sm font-semibold ring-1 ring-line">
              {t("Fix the times")}
            </button>
          </div>
        </>
      ) : evening ? (
        // Evening again: tonight comes first, last night can still be edited
        <>
          <button onClick={() => sleepTracker.startNight(now)} className={`mt-4 flex items-center justify-center gap-2 ${primary}`}>
            <Moon size={16} /> {t("Going to sleep")}
          </button>
          <div className="mt-2 flex justify-center">
            <button onClick={() => openLog()} className={quiet}>
              {t("Edit last night")}
            </button>
          </div>
        </>
      ) : (
        <button onClick={() => openLog()} className={`mt-4 ${primary}`}>
          {t("Edit last night")}
        </button>
      )}
    </>
  ) : tracker.incomplete === today ? (
    // C. Couldn't work it out
    <>
      <p className="text-lg font-bold">{t("Sleep estimate unavailable")}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
        {t("There wasn't enough to estimate last night's sleep. You can enter the times yourself.")}
      </p>
      <button onClick={() => openLog()} className={`mt-4 ${primary}`}>
        {t("Enter sleep times")}
      </button>
    </>
  ) : (
    // Nothing yet: in the evening the main button is "Going to sleep"; in the day, "Log last night"
    <>
      <p className="text-xs font-medium text-ink-soft">{t("Last night")}</p>
      <p className="text-3xl font-bold">
        <span className="text-ink-soft">—</span>
        <span className="text-base font-medium text-ink-soft"> / {goal ? duration(goal) : "—"}</span>
      </p>
      <p className="mt-2 text-xs text-ink-soft">{t("Not logged yet for last night.")}</p>
      {evening ? (
        <>
          <button onClick={() => sleepTracker.startNight(now)} className={`mt-4 flex items-center justify-center gap-2 ${primary}`}>
            <Moon size={16} /> {t("Going to sleep")}
          </button>
          <p className="mt-2 text-center text-[11px] text-ink-soft">{t("Tap again with \"I'm awake\" in the morning.")}</p>
        </>
      ) : (
        <button onClick={() => openLog()} className={`mt-4 ${primary}`}>
          {t("Log last night")}
        </button>
      )}
    </>
  );

  // D. The automatic estimate: off until he turns it on
  const autoRow = (
    <div className="mt-5 flex items-start justify-between gap-3 border-t border-line pt-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{t("Automatic estimate")}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">
          {tracker.auto
            ? t("On. Each morning we estimate your night from when you last closed and first opened this app. Only those times are noted, on this phone.")
            : t("Off. Turn it on and we'll estimate your night from when you close and open this app. It's a guess, not a measurement.")}
        </p>
      </div>
      <button
        role="switch"
        aria-checked={tracker.auto}
        aria-label={t("Automatic estimate")}
        onClick={() => {
          sleepTracker.setAuto(!tracker.auto);
          showToast(t(tracker.auto ? "Automatic estimate off" : "Automatic estimate on"));
        }}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${tracker.auto ? "bg-forest" : "bg-line"}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left] ${tracker.auto ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );

  // Trends: the week in numbers and one plain sentence (only with enough nights)
  const nightOf = (k: string) => {
    const r = dayLatest(records, "sleep", k);
    return r ? { minutes: r.value, bedtime: r.meta?.bedtime, wakeTime: r.meta?.wakeTime, status: r.meta?.status } : null;
  };
  const span = period === 1 ? 7 : period;
  const summary = weekSummary(keys.map(nightOf), keys.map((k) => nightOf(shiftKey(k, -span))), goal);
  const insight = weekInsight(summary, goal);

  return (
    <>
      {period === 1 ? (
        <FoldCard
          id="sleep"
          head={head}
          description={t("Tap when you go to sleep and when you wake up, or enter the times yourself.")}
          peek={
            tracker.night
              ? t("Sleeping since {time}", { time: clockOf(tracker.night.startAt) })
              : lastValue === null
                ? null
                : `${t("Last night")}: ${duration(lastValue)}${category ? ` · ${t(CATEGORY_LABEL[category])}` : ""}`
          }
        >
          {lastNightView}
          {autoRow}
        </FoldCard>
      ) : (
        <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
          {head}
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Stat label={t("Average")} value={avg === null ? "—" : duration(avg)} hint={t("recorded nights")} />
            <Stat label={t("Goal reached")} value={`${met}`} hint={t("of {n} nights", { n: recorded })} />
            <Stat label={t("Quality")} value={avgQuality === null ? "—" : `${score(avgQuality)}/5`} hint={t("average")} />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 text-center">
            <Stat label={t("Usual bedtime")} value={summary.bedtime ?? "—"} hint={t("average")} />
            <Stat label={t("Usual wake-up")} value={summary.wakeTime ?? "—"} hint={t("average")} />
          </div>
          <p className="mt-3 text-[11px] text-ink-soft">
            {t("{n} nights missing", { n: summary.missing })}
            {summary.lowConfidence > 0 ? ` · ${t("{n} unconfirmed estimates", { n: summary.lowConfidence })}` : ""}
            {summary.change !== null ? ` · ${summary.change >= 0 ? "+" : "−"}${duration(Math.abs(summary.change))} ${t("vs the {n} days before", { n: span })}` : ""}
          </p>
          {insight && <p className="mt-2 rounded-2xl bg-mint/60 px-3 py-2 text-xs font-medium text-forest">{t(insight.text, insight.vars)}</p>}

          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-3 text-xs font-medium text-ink-soft">{t("Last {n} nights", { n: period })}</p>
            <DayBars keys={keys} values={values} target={goal} format={duration} />
          </div>
          <p className="mt-3 text-[11px] text-ink-soft">{t("Sleep times are your own or estimates. They're not a medical measurement.")}</p>
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
