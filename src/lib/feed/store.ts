"use client";

// Saves what he did with each activity (Done / Later / Skip) and which lessons he read.
// NOW: on the phone. LATER: Supabase (same shape).

import { useSyncExternalStore } from "react";
import { dateKey } from "../progress/dates";
import { markDeleted, unmarkDeleted, type Tombstones } from "../account/tombstones";
import type { ChallengeEntry } from "../content/hooks";
import { heardSeconds, partsFromOld, unionParts, type HeardParts } from "../course/heard";

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
  /** Discover "do this" cards he did (Step 79): tried["do-kegel"] = when, the points, and "Did it help?". */
  tried?: Record<string, TriedEntry>;
  /** "Try it for N days" challenges from Discover cards (Step 86): challenges["do-kegel"] = start, days done, finish. */
  challenges?: Record<string, ChallengeEntry>;
}

export type HelpedAnswer = "yes" | "some" | "no" | "skip";
export interface TriedEntry {
  /** The day (his time) he tapped "I did it", and when. The first time counts. */
  localDate: string;
  at: string;
  points: number;
  /** His answer to "Did it help?" a few days later (the newest answer wins). Earns no points. */
  helped?: { answer: HelpedAnswer; at: string };
}

export interface CourseProgress {
  /** Where he stopped (seconds), so the lesson continues from there. */
  pos: number;
  /** Seconds of the lesson he has heard, each second once (skipping ahead doesn't count).
   *  Kept for older app versions and Studio; the real record is `parts` (Step 98). */
  heard: number;
  /** Which parts he heard (Step 98): [[0, 190], [400, 480]] = 0:00–3:10 and 6:40–8:00. */
  parts?: HeardParts;
  /** When this was last changed. */
  at: string;
  /** Finished: the day (his time) and the points it earned. */
  done?: { localDate: string; at: string; points: number };
}
export type FeedState = FeedDB & { ready: boolean };

const KEY = "ms_feed_v1";
const EMPTY: FeedDB = { days: {}, lessons: {}, settings: { discreet: false }, deleted: {}, course: {}, tried: {}, challenges: {} };
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
        tried: p.tried && typeof p.tried === "object" ? p.tried : {},
        challenges: p.challenges && typeof p.challenges === "object" ? p.challenges : {},
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
  saveCourseSpot(lessonId: string, pos: number, heardParts: HeardParts, quiet = false) {
    const db = load();
    const have = db.course?.[lessonId];
    // Heard parts only ever grow: what he heard before (or on another phone) stays heard
    const parts = unionParts(partsFromOld(have?.heard, have?.parts), heardParts);
    const next: CourseProgress = {
      ...have,
      pos: Math.max(0, Math.round(pos)),
      heard: Math.round(heardSeconds(parts)),
      parts,
      at: new Date().toISOString(),
    };
    if (have && have.pos === next.pos && JSON.stringify(have.parts ?? null) === JSON.stringify(parts) && !quietPending) return;
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
        [lessonId]: { ...have, pos: have?.pos ?? 0, heard: have?.heard ?? 0, at: now.toISOString(), done: { localDate: dateKey(now), at: now.toISOString(), points } },
      },
    });
  },

  /** "I did it" on a Discover card (Step 79): points the first time. */
  markTried(id: string, points: number, at: Date = new Date()) {
    const db = load();
    if (db.tried?.[id]) return;
    save({
      ...db,
      tried: { ...db.tried, [id]: { localDate: dateKey(at), at: at.toISOString(), points } },
      deleted: unmarkDeleted(db.deleted, `tried:${id}`),
    });
  },

  /** He tapped "I did it" again to take it back: the points go too. */
  unmarkTried(id: string) {
    const db = load();
    if (!db.tried?.[id]) return;
    const tried = { ...db.tried };
    delete tried[id];
    save({ ...db, tried, deleted: markDeleted(db.deleted, `tried:${id}`) });
  },

  /** His answer to "Did it help?". */
  answerHelped(id: string, answer: HelpedAnswer) {
    const db = load();
    const have = db.tried?.[id];
    if (!have) return;
    save({ ...db, tried: { ...db.tried, [id]: { ...have, helped: { answer, at: new Date().toISOString() } } } });
  },

  /** Cards marked done on this phone before Step 79 (they were saved on the phone only): move them into his record. */
  importTried(done: Record<string, string>, points: number) {
    const db = load();
    const tried = { ...db.tried };
    let changed = false;
    for (const [id, when] of Object.entries(done)) {
      const at = new Date(when);
      if (tried[id] || Number.isNaN(at.getTime())) continue;
      tried[id] = { localDate: dateKey(at), at: at.toISOString(), points };
      changed = true;
    }
    if (changed) save({ ...db, tried });
  },

  /** Start a "try it for N days" challenge (Step 86). Starting it again after quitting starts fresh. */
  startChallenge(id: string, length: number, at: Date = new Date()) {
    const db = load();
    const have = db.challenges?.[id];
    if (have && !have.finished) return;
    save({
      ...db,
      challenges: { ...db.challenges, [id]: { start: dateKey(at), at: at.toISOString(), length, days: {} } },
      deleted: unmarkDeleted(db.deleted, `challenge:${id}`),
    });
  },

  /** He did today's day of a challenge. Doing the last day finishes it (and earns the finish points). */
  challengeDay(id: string, finishPoints: number, at: Date = new Date()) {
    const db = load();
    const have = db.challenges?.[id];
    if (!have || have.finished) return;
    const key = dateKey(at);
    if (have.days?.[key]) return;
    const days = { ...have.days, [key]: at.toISOString() };
    const finished = Object.keys(days).length >= have.length ? { localDate: key, at: at.toISOString(), points: finishPoints } : undefined;
    save({ ...db, challenges: { ...db.challenges, [id]: { ...have, days, ...(finished ? { finished } : {}) } } });
  },

  /** He took today's day back. */
  undoChallengeDay(id: string, at: Date = new Date()) {
    const db = load();
    const have = db.challenges?.[id];
    const key = dateKey(at);
    if (!have?.days?.[key] || have.finished) return;
    const days = { ...have.days };
    delete days[key];
    save({ ...db, challenges: { ...db.challenges, [id]: { ...have, days } } });
  },

  /** He stopped a challenge (the points from days he did go too, like taking back "I did it"). */
  quitChallenge(id: string) {
    const db = load();
    if (!db.challenges?.[id]) return;
    const challenges = { ...db.challenges };
    delete challenges[id];
    save({ ...db, challenges, deleted: markDeleted(db.deleted, `challenge:${id}`) });
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
