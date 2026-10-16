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
  /** Course lessons (Step 48): course["wz-1-0"] = where he stopped, how much he heard, when he finished. */
  course?: Record<string, CourseProgress>;
}

export interface CourseProgress {
  /** Where he stopped (seconds), so the lesson continues from there. */
  pos: number;
  /** Seconds he actually listened to (skipping ahead doesn't count). */
  heard: number;
  /** When this was last changed. */
  at: string;
  /** Finished: the day (his time) and the points it earned. */
  done?: { localDate: string; at: string; points: number };
}
export type FeedState = FeedDB & { ready: boolean };

const KEY = "ms_feed_v1";
const EMPTY: FeedDB = { days: {}, lessons: {}, settings: { discreet: false }, deleted: {}, course: {} };
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
        course: p.course && typeof p.course === "object" ? p.course : {},
      };
    }
  } catch {
    // Storage blocked or corrupted — start empty rather than crash
  }
  cache = { ...db, ready: true };
  return cache;
}

/** A quiet spot save happened that the app (and his account) hasn't heard about yet. */
let quietPending = false;

function save(next: FeedDB, quiet = false) {
  cache = { ...next, ready: true };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // keep working in memory
  }
  // Quiet: kept on the phone only — no redraw of the app, no upload (used while a lesson plays)
  if (quiet) return;
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

  /** Where he is in a course lesson. `heard` only ever grows. */
  /** Where he is in a lesson. `quiet` while it plays (kept on the phone only, so nothing redraws or
   *  uploads every few seconds and scrolling stays smooth); a normal save on pause / leaving / the end. */
  saveCourseSpot(lessonId: string, pos: number, heard: number, quiet = false) {
    const db = load();
    const have = db.course?.[lessonId];
    const next: CourseProgress = {
      ...have,
      pos: Math.max(0, Math.round(pos)),
      heard: Math.max(have?.heard ?? 0, Math.round(heard)),
      at: new Date().toISOString(),
    };
    if (have && have.pos === next.pos && have.heard === next.heard && !quietPending) return;
    quietPending = quiet;
    save({ ...db, course: { ...db.course, [lessonId]: next } }, quiet);
  },

  /** He finished a course lesson (the first time counts; points are saved with it). */
  finishCourseLesson(lessonId: string, points: number) {
    const db = load();
    const have = db.course?.[lessonId];
    if (have?.done) return;
    const now = new Date();
    save({
      ...db,
      course: {
        ...db.course,
        [lessonId]: { pos: have?.pos ?? 0, heard: have?.heard ?? 0, at: now.toISOString(), done: { localDate: dateKey(now), at: now.toISOString(), points } },
      },
    });
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
