"use client";

// The sleep helper on this phone (Step 56). Kept on the phone only — never sent to his account:
// - "Going to sleep" / "I'm awake" taps (the night in progress),
// - if he turns on the automatic estimate: the times this app was open on screen (start and end only,
//   nothing about what he did), kept for 2 days.
// The finished night itself is saved as a normal sleep record (progress store), which does sync.

import { useSyncExternalStore } from "react";
import { dateKey } from "./dates";
import { estimateFromSeen, mergeSeen, sessionMinutes, type Seen } from "./sleep";
import { progressStore } from "./store";
import type { TrackingRecord } from "./types";

const KEY = "ms_sleep_v1";

export interface TrackerState {
  /** Automatic estimate from app use: off until he turns it on. */
  auto: boolean;
  /** He tapped "Going to sleep" at this time and hasn't tapped "I'm awake" yet. */
  night: { startAt: string } | null;
  /** The morning (YYYY-MM-DD) whose night couldn't be worked out — the card offers to enter it. */
  incomplete: string | null;
  /** Mornings already estimated (so deleting an estimate doesn't bring it back). */
  estimated: string[];
  seen: Seen[];
  /** Android app: segments from Google's sleep detection already turned into nights (so a deleted one stays deleted). */
  imported: string[];
}

const EMPTY: TrackerState = { auto: false, night: null, incomplete: null, estimated: [], seen: [], imported: [] };
let cache: TrackerState | null = null;
const listeners = new Set<() => void>();

function load(): TrackerState {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<TrackerState>) } : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function save(next: TrackerState, notify = true) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  if (notify) listeners.forEach((l) => l());
}

export function useSleepTracker(): TrackerState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    load,
    () => EMPTY,
  );
}

const TWO_DAYS = 48 * 3600_000;

export const sleepTracker = {
  get: load,

  setAuto(on: boolean) {
    // Turning it off also forgets the app-use times
    save({ ...load(), auto: on, seen: on ? load().seen : [] });
  },

  /** "Going to sleep" */
  startNight(now = new Date()) {
    save({ ...load(), night: { startAt: now.toISOString() }, incomplete: null });
  },

  cancelNight() {
    save({ ...load(), night: null });
  },

  /** "I'm awake" (or "I woke up at …"): saves the night. Returns the record, or null if the times don't make a night. */
  endNight(end = new Date(), startAt?: string): TrackingRecord | null {
    const s = load();
    const start = startAt ?? s.night?.startAt;
    const minutes = sessionMinutes(start, end);
    if (!start || minutes === null) return null;
    const rec = progressStore.saveNight({ startAt: start, endAt: end.toISOString(), minutes, how: "tap", status: "confirmed" });
    save({ ...load(), night: null, incomplete: null });
    return rec;
  },

  /** The app is on screen: note it (only when the automatic estimate is on). Quiet: nothing redraws. */
  noteSeen(now = Date.now()) {
    const s = load();
    if (!s.auto) return;
    const seen = mergeSeen([...s.seen, [now, now]]).filter(([, b]) => b > now - TWO_DAYS);
    save({ ...s, seen }, false);
  },

  /**
   * Opening the app in the morning: finish what can be finished.
   * - A "Going to sleep" left running for over 16 hours can't be a night: it becomes "incomplete".
   * - With the automatic estimate on and no night saved for today: estimate it from app use.
   */
  checkMorning(records: TrackingRecord[], now = new Date()) {
    const s = load();
    const today = dateKey(now);
    if (s.night && now.getTime() - new Date(s.night.startAt).getTime() > 16 * 3600_000) {
      save({ ...s, night: null, incomplete: today });
      return;
    }
    if (!s.auto || s.night || s.estimated.includes(today)) return;
    if (records.some((r) => r.metric === "sleep" && r.localDate === today)) return;
    const e = estimateFromSeen(s.seen, now.getTime());
    const estimated = [...s.estimated.filter((d) => d >= dateKey(new Date(now.getTime() - 7 * 86400_000))), today];
    if (!e) {
      // Only say "unavailable" in the morning, once there's been a chance to estimate
      const h = now.getHours();
      if (h >= 5 && h < 13) save({ ...load(), estimated, incomplete: today });
      return;
    }
    progressStore.saveNight({ ...e, how: "app_activity", status: "estimated" });
    save({ ...load(), estimated, incomplete: null });
  },

  setImported(imported: string[]) {
    save({ ...load(), imported, incomplete: null });
  },

  clearIncomplete() {
    save({ ...load(), incomplete: null });
  },
};
