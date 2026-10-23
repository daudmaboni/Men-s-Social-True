// "You, then and now" (Step 86): every week or so a card on Discover puts his own numbers side by side,
// a month ago (or his first week) against the last 7 days. Only what he recorded himself; days he
// recorded nothing are left out, never counted as zero. It shows change, not what caused it.

import { averageRecorded, dayLatest, dayTotal } from "./calc";
import { shiftKey } from "./dates";
import type { TrackingRecord } from "./types";

export type ThenNowMetric = "sleep" | "water" | "energy" | "mood" | "cards";

export interface ThenNowRow {
  metric: ThenNowMetric;
  then: number;
  now: number;
  /** now − then, in the metric's own unit (minutes, ml, points on 1–5, cards). */
  change: number;
  /** Is the change in the direction he'd want? */
  better: boolean;
}

export interface ThenNow {
  /** First and last day of each window (his dates). */
  thenFrom: string;
  thenTo: string;
  nowFrom: string;
  nowTo: string;
  /** "month" = the same week a month ago; "start" = his first week in the app. */
  basis: "month" | "start";
  rows: ThenNowRow[];
}

/** A window needs this many recorded days of a metric to say anything about it. */
export const MIN_DAYS = 2;
/** He needs to have been using the app this long before there's a "then". */
export const MIN_SPAN_DAYS = 14;

const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => shiftKey(from, i));

function avgOf(records: TrackingRecord[], metric: "sleep" | "water" | "energy" | "mood", keys: string[]): { avg: number | null; n: number } {
  const vals = keys.map((k) => (metric === "water" ? dayTotal(records, metric, k) : (dayLatest(records, metric, k)?.value ?? null)));
  return { avg: averageRecorded(vals), n: vals.filter((v) => v !== null).length };
}

/**
 * His then-and-now, or null when there isn't enough to compare yet.
 * @param doneDates his dates he did a Discover card or a challenge day (one entry per thing done)
 */
export function thenAndNow(records: TrackingRecord[], doneDates: string[], today: string): ThenNow | null {
  const nowFrom = shiftKey(today, -6);
  const nowKeys = days(nowFrom, 7);
  const firstDay = [...records.map((r) => r.localDate), ...doneDates].sort()[0];
  if (!firstDay || firstDay > shiftKey(today, -MIN_SPAN_DAYS)) return null;

  // A month ago if he was around then, else his first week
  const monthFrom = shiftKey(today, -34);
  const basis: ThenNow["basis"] = firstDay <= shiftKey(monthFrom, 3) ? "month" : "start";
  const thenFrom = basis === "month" ? monthFrom : firstDay;
  const thenKeys = days(thenFrom, 7).filter((k) => k < nowFrom);
  if (thenKeys.length < 3) return null;

  const rows: ThenNowRow[] = [];
  for (const metric of ["sleep", "water", "energy", "mood"] as const) {
    const a = avgOf(records, metric, thenKeys);
    const b = avgOf(records, metric, nowKeys);
    if (a.avg === null || b.avg === null || a.n < MIN_DAYS || b.n < MIN_DAYS) continue;
    const change = b.avg - a.avg;
    // Sleep: closer to 7–9 h is better; the rest: more is better
    const better = metric === "sleep" ? Math.abs(b.avg - 480) < Math.abs(a.avg - 480) : change > 0;
    rows.push({ metric, then: a.avg, now: b.avg, change, better });
  }
  const thenSet = new Set(thenKeys);
  const nowSet = new Set(nowKeys);
  const cardsThen = doneDates.filter((d) => thenSet.has(d)).length;
  const cardsNow = doneDates.filter((d) => nowSet.has(d)).length;
  if (cardsThen + cardsNow > 0) rows.push({ metric: "cards", then: cardsThen, now: cardsNow, change: cardsNow - cardsThen, better: cardsNow > cardsThen });

  // Worth a card only with at least two things to compare, and something that moved
  if (rows.length < 2 || rows.every((r) => Math.abs(r.change) < 0.01)) return null;
  return { thenFrom, thenTo: thenKeys[thenKeys.length - 1], nowFrom, nowTo: today, basis, rows };
}

/** How often the card may come back: once a week at most. */
export const THEN_NOW_EVERY_DAYS = 7;
