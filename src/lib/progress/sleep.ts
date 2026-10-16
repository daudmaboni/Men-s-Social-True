// Sleep sessions (Step 56): the sums and rules, kept separate from the screens so they can be tested.
//
// Honest about what a web app can know: it can't feel the phone move or run overnight. So a night comes from
// (best first) his own taps ("Going to sleep" / "I'm awake"), times he types in, or — only if he turns it on —
// an estimate from when he last closed and first opened this app. An estimate is always labelled as one,
// carries a confidence, and is never invented when the evidence isn't there.
// Later the Android app adds Google's Sleep API as another source ("sleep_api"), with the same shape.

/** Where a night's times came from. */
export type SleepHow = "tap" | "app_activity" | "manual" | "sleep_api";
/** estimated: worked out by the app; confirmed: he said it's right (or tapped both ends);
 *  corrected: he changed an estimate; in_progress / incomplete are never saved as a night. */
export type SleepStatus = "estimated" | "confirmed" | "corrected";
export type SleepCategory = "very_short" | "insufficient" | "within_target" | "long_sleep";

/** Longest night we accept as real; anything longer is a mistake (e.g. a forgotten "I'm awake"). */
export const MAX_SLEEP_MIN = 16 * 60;
export const MIN_SLEEP_MIN = 60;

/** Minutes between two times, or null when they're missing, reversed or implausible. */
export function sessionMinutes(startAt: string | Date | null | undefined, endAt: string | Date | null | undefined): number | null {
  if (!startAt || !endAt) return null;
  const s = new Date(startAt).getTime();
  const e = new Date(endAt).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  const min = Math.round((e - s) / 60_000);
  if (min < MIN_SLEEP_MIN || min > MAX_SLEEP_MIN) return null;
  return min;
}

/** Adult duration bands (a separate policy from his personal goal). */
export function sleepCategory(min: number | null | undefined): SleepCategory | null {
  if (min == null || !Number.isFinite(min) || min <= 0) return null;
  if (min < 300) return "very_short";
  if (min < 420) return "insufficient";
  if (min <= 540) return "within_target";
  return "long_sleep";
}

export const CATEGORY_LABEL: Record<SleepCategory, string> = {
  very_short: "Very short",
  insufficient: "Below 7 hours",
  within_target: "Within 7–9 hours",
  long_sleep: "Over 9 hours",
};

/** "23:40" in his own timezone. */
export function clockOf(at: string | Date): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Minutes after midnight for "HH:MM". */
const toMin = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * Average of clock times that may cross midnight (23:30 and 00:30 average to 00:00, not 12:00).
 * Uses the mean of angles on a 24-hour circle. null when there are none.
 */
export function averageClock(times: (string | null | undefined)[]): string | null {
  const mins = times.map((t) => (t ? toMin(t) : null)).filter((m): m is number => m !== null);
  if (mins.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const m of mins) {
    const a = (m / 1440) * 2 * Math.PI;
    x += Math.cos(a);
    y += Math.sin(a);
  }
  let a = Math.atan2(y, x);
  if (a < 0) a += 2 * Math.PI;
  const avg = Math.round((a / (2 * Math.PI)) * 1440) % 1440;
  return `${String(Math.floor(avg / 60)).padStart(2, "0")}:${String(avg % 60).padStart(2, "0")}`;
}

/** How far (in minutes) clock times spread around their average — big = an irregular schedule. */
export function clockSpread(times: (string | null | undefined)[]): number | null {
  const avg = averageClock(times);
  const mins = times.map((t) => (t ? toMin(t) : null)).filter((m): m is number => m !== null);
  if (!avg || mins.length < 2) return null;
  const c = toMin(avg)!;
  const diffs = mins.map((m) => {
    const d = Math.abs(m - c) % 1440;
    return Math.min(d, 1440 - d);
  });
  return Math.round(diffs.reduce((s, d) => s + d, 0) / diffs.length);
}

// ---- The estimate from app use ----

/** A stretch of time the app was open on screen: [start ms, end ms]. */
export type Seen = [number, number];

/** Merge overlapping / touching stretches and sort them. */
export function mergeSeen(seen: Seen[], gapMs = 60_000): Seen[] {
  const sorted = seen.filter(([a, b]) => b >= a).sort((p, q) => p[0] - q[0]);
  const out: Seen[] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + gapMs) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

export interface Estimate {
  startAt: string;
  endAt: string;
  minutes: number;
  confidence: number;
}

const hourOf = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() + d.getMinutes() / 60;
};
/** Night window for falling asleep: 19:00–04:00. */
const inBedWindow = (ms: number) => {
  const h = hourOf(ms);
  return h >= 19 || h < 4;
};
/** Morning window for waking: 03:00–13:00. */
const inWakeWindow = (ms: number) => {
  const h = hourOf(ms);
  return h >= 3 && h < 13;
};

/**
 * Last night from app use: the longest gap between closing the app at night and opening it in the morning.
 * It only shows the longest time the app was NOT used, so it's an upper bound on sleep: confidence stays low.
 * No estimate when there's no evening use, no morning use, or the gap isn't a plausible night (3–14 h).
 */
export function estimateFromSeen(seen: Seen[], now: number): Estimate | null {
  if (!inWakeWindow(now)) return null;
  const s = mergeSeen(seen).filter(([, b]) => b <= now + 60_000 && b >= now - 36 * 3600_000);
  let best: { from: number; to: number } | null = null;
  for (let i = 0; i < s.length - 1; i++) {
    const from = s[i][1];
    const to = s[i + 1][0];
    const gap = to - from;
    if (!inBedWindow(from) || !inWakeWindow(to)) continue;
    if (gap < 3 * 3600_000 || gap > 14 * 3600_000) continue;
    if (!best || gap > best.to - best.from) best = { from, to };
  }
  if (!best) return null;
  const minutes = sessionMinutes(new Date(best.from), new Date(best.to));
  if (minutes === null) return null;
  // Longer than 10 hours is more likely "didn't open the app" than sleep: even less sure
  const confidence = minutes > 600 ? 0.2 : 0.35;
  return { startAt: new Date(best.from).toISOString(), endAt: new Date(best.to).toISOString(), minutes, confidence };
}

// ---- The week ----

export interface NightLike {
  minutes: number | null;
  bedtime?: string | null;
  wakeTime?: string | null;
  status?: SleepStatus | null;
  confidence?: number | null;
}

export interface WeekSummary {
  nights: number; // recorded nights
  missing: number; // nights with nothing
  lowConfidence: number; // estimates he never confirmed
  average: number | null;
  withinGoal: number;
  bedtime: string | null;
  wakeTime: string | null;
  bedSpread: number | null;
  change: number | null; // vs the week before, in minutes
}

export function weekSummary(week: (NightLike | null)[], previous: (NightLike | null)[], goal: number | null): WeekSummary {
  const done = week.filter((n): n is NightLike => !!n && n.minutes != null && n.minutes > 0);
  const prev = previous.filter((n): n is NightLike => !!n && n.minutes != null && n.minutes > 0);
  const avg = (xs: NightLike[]) => (xs.length ? Math.round(xs.reduce((s, n) => s + (n.minutes ?? 0), 0) / xs.length) : null);
  const average = avg(done);
  const prevAvg = avg(prev);
  return {
    nights: done.length,
    missing: week.length - done.length,
    lowConfidence: done.filter((n) => n.status === "estimated").length,
    average,
    withinGoal: goal ? done.filter((n) => (n.minutes ?? 0) >= goal).length : 0,
    bedtime: averageClock(done.map((n) => n.bedtime)),
    wakeTime: averageClock(done.map((n) => n.wakeTime)),
    bedSpread: clockSpread(done.map((n) => n.bedtime)),
    change: average !== null && prevAvg !== null && prev.length >= 3 ? average - prevAvg : null,
  };
}

/** One plain sentence about the week, or null when there isn't enough to say anything (fewer than 3 nights). */
export function weekInsight(w: WeekSummary, goal: number | null): { text: string; vars?: Record<string, string | number> } | null {
  if (w.nights < 3) return w.nights > 0 ? { text: "Log a few more nights to see your pattern." } : null;
  if (w.average !== null && w.average < 300)
    return { text: "Your nights have been very short. If sleep is often hard for you, talk to a doctor." };
  if (goal && w.average !== null && w.average < goal)
    return { text: "You're sleeping less than your goal. A fixed bedtime with time to wind down can help." };
  if (w.bedSpread !== null && w.bedSpread > 75)
    return { text: "Your bedtime changes a lot from night to night. A steadier bedtime often makes mornings easier." };
  if (w.missing >= 3) return { text: "Some nights are missing, so this picture is incomplete." };
  return { text: "Your sleep has been steady this week. Keep it up." };
}
