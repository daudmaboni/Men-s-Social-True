// All progress formulas live here, so every screen calculates the same way.
// Rule: "nothing recorded" is null, never 0 — missing data must not look like zero.

import type { MetricStatus, MetricType, TrackingRecord } from "./types";

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** A. Daily target progress: min(actual / target × 100, 100). */
export function targetProgress(actual: number | null, target: number | null): number | null {
  if (!isNum(actual) || !isNum(target) || target <= 0) return null;
  return Math.min(Math.max((actual / target) * 100, 0), 100);
}

/** B. Habit adherence: completed / eligible scheduled × 100. */
export function adherence(completed: number, eligible: number): number | null {
  if (!isNum(completed) || !isNum(eligible) || eligible <= 0) return null;
  return Math.min((completed / eligible) * 100, 100);
}

/** C. Measurement change: latest − baseline. */
export function measurementChange(latest: number | null, baseline: number | null): number | null {
  if (!isNum(latest) || !isNum(baseline)) return null;
  return latest - baseline;
}

/** D. Energy balance: consumed − total daily expenditure. */
export function energyBalance(consumed: number | null, totalExpenditure: number | null): number | null {
  if (!isNum(consumed) || !isNum(totalExpenditure)) return null;
  return consumed - totalExpenditure;
}

/** Tracked, goal achieved, or not yet recorded. */
export function metricStatus(actual: number | null, target: number | null): MetricStatus {
  if (!isNum(actual)) return "not_recorded";
  const p = targetProgress(actual, target);
  return p !== null && p >= 100 ? "goal_achieved" : "tracked";
}

/** Total for one metric on one day — null if he recorded nothing that day. */
export function dayTotal(records: TrackingRecord[], metric: MetricType, key: string): number | null {
  const day = records.filter((r) => r.metric === metric && r.localDate === key);
  if (day.length === 0) return null;
  return day.reduce((sum, r) => sum + r.value, 0);
}

/** Totals for many days (null where nothing was recorded). */
export function dayTotals(records: TrackingRecord[], metric: MetricType, keys: string[]): (number | null)[] {
  return keys.map((k) => dayTotal(records, metric, k));
}

/** Latest record of a metric on a day (for once-a-day logs like sleep or a check-in). */
export function dayLatest(records: TrackingRecord[], metric: MetricType, key: string): TrackingRecord | null {
  const day = records
    .filter((r) => r.metric === metric && r.localDate === key)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return day[0] ?? null;
}

/** Latest value per day for many days (null where nothing was recorded). */
export function dayLatestValues(records: TrackingRecord[], metric: MetricType, keys: string[]): (number | null)[] {
  return keys.map((k) => dayLatest(records, metric, k)?.value ?? null);
}

/** Sleep length in minutes from "HH:MM" bedtime to "HH:MM" wake time (crosses midnight). */
export function sleepMinutes(bedtime: string, wakeTime: string): number | null {
  const parse = (t: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    return h < 24 && min < 60 ? h * 60 + min : null;
  };
  const bed = parse(bedtime);
  const wake = parse(wakeTime);
  if (bed === null || wake === null) return null;
  const diff = (wake - bed + 1440) % 1440;
  return diff === 0 ? null : diff;
}

/** Change between two averages (this period vs the one before). null if either is missing. */
export function periodChange(current: number | null, previous: number | null): number | null {
  if (!isNum(current) || !isNum(previous)) return null;
  return current - previous;
}

/** Average over recorded days only — skipped days are left out, not counted as 0. */
export function averageRecorded(values: (number | null)[]): number | null {
  const recorded = values.filter(isNum);
  if (recorded.length === 0) return null;
  return recorded.reduce((a, b) => a + b, 0) / recorded.length;
}

/** How many recorded days reached the target. */
export function daysGoalMet(values: (number | null)[], target: number | null): number {
  return values.filter((v) => targetProgress(v, target) === 100).length;
}

/** Day streak: consecutive days (ending today or yesterday) where the goal was met. */
export function goalStreak(values: (number | null)[], target: number | null): number {
  let i = values.length - 1;
  // Today isn't over yet, so an unfinished today doesn't break the streak
  if (targetProgress(values[i] ?? null, target) !== 100) i--;
  let streak = 0;
  for (; i >= 0; i--) {
    if (targetProgress(values[i] ?? null, target) === 100) streak++;
    else break;
  }
  return streak;
}
