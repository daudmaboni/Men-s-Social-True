"use client";

// Saves what he did with each activity (Done / Later / Skip) and which lessons he read.
// NOW: on the phone. LATER: Supabase (same shape).

import { useSyncExternalStore } from "react";
import { dateKey } from "../progress/dates";
import { markDeleted, unmarkDeleted, type Tombstones } from "../account/tombstones";

export type ChoiceStatus = "done" | "later" | "skipped";

export interface FeedDB {
  /** days["2026-10-13"]["walk"] = { status: "done", at: "..." } */
  days: Record<string, Record<string, { status: ChoiceStatus; at: string }>>;
  /** lessons["sleep-and-energy"] = { localDate, at } */
  lessons: Record<string, { localDate: string; at: string }>;
  /** updatedAt: when he last switched discreet mode (the newest switch wins across phones). */
  settings: { discreet: boolean; updatedAt?: string };
  /** What he undid, and when — so another phone doesn't bring it back (see account/tombstones.ts). */
  deleted?: Tombstones;
}
export type FeedState = FeedDB & { ready: boolean };

const KEY = "ms_feed_v1";
const EMPTY: FeedDB = { days: {}, lessons: {}, settings: { discreet: false }, deleted: {} };
const SERVER_STATE: FeedState = { ...EMPTY, ready: false };
let cache: FeedState | null = null;
const listeners = new Set<() => void>();
/** Told only about HIS changes (not about data arriving from his account), so they can be saved to it. */
const changeListeners = new Set<() => void>();

function load(): FeedState {
  if (cache) return cache;
  let db: FeedDB = EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<FeedDB>;
      db = {
        days: p.days && typeof p.days === "object" ? p.days : {},
        lessons: p.lessons && typeof p.lessons === "object" ? p.lessons : {},
        settings: {
          discreet: Boolean(p.settings?.discreet),
          ...(typeof p.settings?.updatedAt === "string" ? { updatedAt: p.settings.updatedAt } : {}),
        },
        deleted: p.deleted && typeof p.deleted === "object" ? p.deleted : {},
      };
    }
  } catch {
    // Storage blocked or corrupted — start empty rather than crash
  }
  cache = { ...db, ready: true };
  return cache;
}

function save(next: FeedDB) {
  cache = { ...next, ready: true };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // keep working in memory
  }
  listeners.forEach((l) => l());
  changeListeners.forEach((l) => l());
}

export function useFeed(): FeedState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    load,
    () => SERVER_STATE,
  );
}

export const feedStore = {
  /** Mark an activity Done / Later / Skipped for today. */
  setChoice(activityId: string, status: ChoiceStatus) {
    const db = load();
    const today = dateKey(new Date());
    save({
      ...db,
      days: { ...db.days, [today]: { ...db.days[today], [activityId]: { status, at: new Date().toISOString() } } },
      deleted: unmarkDeleted(db.deleted, `choice:${today}:${activityId}`),
    });
  },

  /** Undo today's choice for an activity (back to pending). */
  clearChoice(activityId: string) {
    const db = load();
    const today = dateKey(new Date());
    const day = { ...db.days[today] };
    delete day[activityId];
    save({ ...db, days: { ...db.days, [today]: day }, deleted: markDeleted(db.deleted, `choice:${today}:${activityId}`) });
  },

  markLessonRead(lessonId: string) {
    const db = load();
    if (db.lessons[lessonId]) return;
    const now = new Date();
    save({ ...db, lessons: { ...db.lessons, [lessonId]: { localDate: dateKey(now), at: now.toISOString() } } });
  },

  setDiscreet(discreet: boolean) {
    const db = load();
    save({ ...db, settings: { ...db.settings, discreet, updatedAt: new Date().toISOString() } });
  },
};

/** Used by account sync: read, replace or clear this phone's copy. */
export const feedSync = {
  get(): FeedDB {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ready, ...db } = load();
    return db;
  },
  /** Data from his account: saved on the phone and shown, but not sent back again. */
  replace(db: FeedDB) {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {}
    cache = null;
    load();
    listeners.forEach((l) => l());
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    cache = null;
    listeners.forEach((l) => l());
  },
  onChange(cb: () => void) {
    changeListeners.add(cb);
    return () => {
      changeListeners.delete(cb);
    };
  },
};
