"use client";

// Step 100: saves his journey on the phone (key ms_journey_v1) and tells account sync when he changes it,
// the same way the feed and progress stores work. In his account it's its own private row (kind "journey"):
// only he can read it, and it is NOT part of what staff can see when he shares his records with support.
// Nothing here is sent to analytics or written to the console.

import { useSyncExternalStore } from "react";
import { dateKey } from "../progress/dates";
import { markDeleted, mergeTombstones, isDeleted, unmarkDeleted } from "../account/tombstones";
import { ASSESSMENT_VERSION } from "./engine";
import { tidyAnswers } from "./questions";
import type { Answers, ConcernId, JourneyDB, Review, ReviewAnswer } from "./types";

export type JourneyState = JourneyDB & { ready: boolean };

const KEY = "ms_journey_v1";
const EMPTY: JourneyDB = { done: {}, handled: {}, snoozed: {}, reviews: [], deleted: {} };
const SERVER_STATE: JourneyState = { ...EMPTY, ready: false };
let cache: JourneyState | null = null;
const listeners = new Set<() => void>();
const changeListeners = new Set<() => void>();

const obj = <T,>(v: unknown, fallback: T): T => (v && typeof v === "object" && !Array.isArray(v) ? (v as T) : fallback);

/** Read a saved copy safely: anything broken is dropped rather than crashing the app. */
export function cleanJourney(p: Partial<JourneyDB> | null | undefined): JourneyDB {
  const a = p?.assessment;
  const assessment =
    a && typeof a === "object" && a.answers && typeof a.answers === "object" && typeof a.at === "string" && typeof a.startedOn === "string"
      ? { answers: a.answers as Answers, at: a.at, version: Number(a.version) || 1, startedOn: a.startedOn }
      : undefined;
  return {
    ...(assessment ? { assessment } : {}),
    done: obj(p?.done, {}),
    handled: obj(p?.handled, {}),
    snoozed: obj(p?.snoozed, {}),
    reviews: Array.isArray(p?.reviews) ? p!.reviews.filter((r) => r && typeof r.at === "string" && typeof r.localDate === "string") : [],
    ...(p?.smaller && typeof p.smaller.at === "string" ? { smaller: { on: Boolean(p.smaller.on), at: p.smaller.at } } : {}),
    deleted: obj(p?.deleted, {}),
  };
}

function load(): JourneyState {
  if (cache) return cache;
  let db = EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) db = cleanJourney(JSON.parse(raw) as Partial<JourneyDB>);
  } catch {
    // storage blocked or broken: start empty
  }
  cache = { ...db, ready: true };
  return cache;
}

function save(state: JourneyDB) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ready, ...next } = state as JourneyState;
  cache = { ...next, ready: true };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // keep working in memory
  }
  listeners.forEach((l) => l());
  changeListeners.forEach((l) => l());
}

export function useJourney(): JourneyState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    load,
    () => SERVER_STATE,
  );
}

export const journeyStore = {
  /** He finished the assessment (first time or again). The start day stays; what he did is kept. */
  saveAssessment(answers: Answers, now: Date = new Date()) {
    const db = load();
    const startedOn = db.assessment?.startedOn ?? dateKey(now);
    save({
      ...db,
      assessment: { answers: tidyAnswers(answers), at: now.toISOString(), version: ASSESSMENT_VERSION, startedOn },
      deleted: unmarkDeleted(db.deleted, "assessment"),
    });
  },

  /** Start over: forget the assessment and plan. His Man-tab records are not touched. */
  reset(now: Date = new Date()) {
    const db = load();
    save({ ...EMPTY, deleted: markDeleted(db.deleted, "assessment", now.toISOString()) });
  },

  /** Tick or untick one of his own plan tasks for today. */
  toggleDone(taskId: string, now: Date = new Date()) {
    const db = load();
    const day = dateKey(now);
    const have = db.done?.[day]?.[taskId];
    const dayMap = { ...db.done?.[day] };
    if (have) {
      delete dayMap[taskId];
      save({ ...db, done: { ...db.done, [day]: dayMap }, deleted: markDeleted(db.deleted, `done:${day}:${taskId}`) });
    } else {
      dayMap[taskId] = now.toISOString();
      save({ ...db, done: { ...db.done, [day]: dayMap }, deleted: unmarkDeleted(db.deleted, `done:${day}:${taskId}`) });
    }
  },

  /** "I've booked it / I've been seen" on a safety note. */
  handle(noteId: string, now: Date = new Date()) {
    const db = load();
    save({ ...db, handled: { ...db.handled, [noteId]: now.toISOString() } });
  },

  /** "Later": not the main action again today. */
  snooze(noteId: string, now: Date = new Date()) {
    const db = load();
    save({ ...db, snoozed: { ...db.snoozed, [noteId]: dateKey(now) } });
  },

  saveReview(answers: Partial<Record<ConcernId | "overall", ReviewAnswer>>, now: Date = new Date()) {
    const db = load();
    const review: Review = { at: now.toISOString(), localDate: dateKey(now), answers };
    save({ ...db, reviews: [...(db.reviews ?? []), review] });
  },

  setSmaller(on: boolean, now: Date = new Date()) {
    const db = load();
    save({ ...db, smaller: { on, at: now.toISOString() } });
  },
};

/** For account sync: read, replace or clear this phone's copy. */
export const journeySync = {
  get(): JourneyDB {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ready, ...db } = load();
    return db;
  },
  replace(db: JourneyDB) {
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

/**
 * Two copies (this phone and his account) into one, nothing lost:
 * the newest assessment wins (unless he started over after it), ticks from both phones count
 * (an untick after a tick removes it), handled notes and reviews from both are kept.
 */
export function mergeJourney(local: JourneyDB, remote: Partial<JourneyDB> | null, now: Date = new Date()): JourneyDB {
  const l = cleanJourney(local);
  const r = cleanJourney(remote);
  const deleted = mergeTombstones(l.deleted, r.deleted, now);
  let assessment = !l.assessment ? r.assessment : !r.assessment ? l.assessment : r.assessment.at > l.assessment.at ? r.assessment : l.assessment;
  if (assessment && isDeleted(deleted, "assessment", assessment.at)) assessment = undefined;
  // Started over: everything from before that moment goes too
  const resetAt = deleted.assessment;
  const after = (at: string) => !resetAt || at > resetAt;

  const done: NonNullable<JourneyDB["done"]> = {};
  for (const src of [l.done ?? {}, r.done ?? {}]) {
    for (const [day, ticks] of Object.entries(src)) {
      for (const [id, at] of Object.entries(ticks ?? {})) {
        if (typeof at !== "string" || !after(at) || isDeleted(deleted, `done:${day}:${id}`, at)) continue;
        const have = done[day]?.[id];
        if (!have || at < have) done[day] = { ...done[day], [id]: at };
      }
    }
  }
  const handled: Record<string, string> = {};
  for (const src of [l.handled ?? {}, r.handled ?? {}])
    for (const [id, at] of Object.entries(src)) if (after(at) && (!handled[id] || at < handled[id])) handled[id] = at;
  const snoozed: Record<string, string> = {};
  for (const src of [l.snoozed ?? {}, r.snoozed ?? {}]) for (const [id, day] of Object.entries(src)) if (!snoozed[id] || day > snoozed[id]) snoozed[id] = day;
  const byAt = new Map<string, Review>();
  for (const rv of [...(l.reviews ?? []), ...(r.reviews ?? [])]) if (after(rv.at)) byAt.set(rv.at, rv);
  const reviews = [...byAt.values()].sort((p, q) => p.at.localeCompare(q.at));
  const smaller = !l.smaller ? r.smaller : !r.smaller ? l.smaller : r.smaller.at > l.smaller.at ? r.smaller : l.smaller;

  return { ...(assessment ? { assessment } : {}), done, handled, snoozed, reviews, ...(smaller && after(smaller.at) ? { smaller } : {}), deleted };
}
