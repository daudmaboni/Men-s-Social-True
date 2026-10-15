"use client";

// Saves progress records and goals.
// NOW: on the phone (localStorage) so it works before sign-up.
// LATER: this file is swapped for Supabase — the screens don't change.

import { useSyncExternalStore } from "react";
import { dateKey } from "./dates";
import { markDeleted, type Tombstones } from "../account/tombstones";
import type { Goal, MetricType, RecordMeta, RecordSource, TrackingRecord, Unit } from "./types";

const KEY = "ms_progress_v1";

/** deleted: records he deleted, and when — so another phone doesn't bring them back (see account/tombstones.ts). */
type DB = { records: TrackingRecord[]; goals: Goal[]; deleted?: Tombstones };
export type ProgressState = DB & { ready: boolean };

// Starting goals — the man can change them.
const DEFAULT_GOALS: Goal[] = [
  { metric: "water", target: 2500, unit: "ml", period: "day", direction: "increase", updatedAt: "" },
  { metric: "sleep", target: 420, unit: "min", period: "day", direction: "increase", updatedAt: "" },
];

/** Adds any default goal the saved data doesn't have yet (e.g. after a new tracker is added). */
function withDefaults(goals: Goal[]): Goal[] {
  const missing = DEFAULT_GOALS.filter((d) => !goals.some((g) => g.metric === d.metric));
  return [...goals, ...missing];
}

const SERVER_STATE: ProgressState = { records: [], goals: DEFAULT_GOALS, deleted: {}, ready: false };
let cache: ProgressState | null = null;
const listeners = new Set<() => void>();
/** Told only about HIS changes (not about data arriving from his account), so they can be saved to it. */
const changeListeners = new Set<() => void>();

function load(): ProgressState {
  if (cache) return cache;
  let db: DB = { records: [], goals: DEFAULT_GOALS, deleted: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DB>;
      db = {
        records: Array.isArray(parsed.records) ? parsed.records : [],
        goals: withDefaults(Array.isArray(parsed.goals) ? parsed.goals : []),
        deleted: parsed.deleted && typeof parsed.deleted === "object" ? parsed.deleted : {},
      };
    }
  } catch {
    // Storage blocked or corrupted — start empty rather than crash
  }
  cache = { ...db, ready: true };
  return cache;
}

function save(next: DB) {
  cache = { ...next, ready: true };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked — keep working in memory for this visit
  }
  listeners.forEach((l) => l());
  changeListeners.forEach((l) => l());
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** React hook: the current records and goals; re-renders when they change. */
export function useProgress(): ProgressState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    load,
    () => SERVER_STATE,
  );
}

type NewRecord = {
  metric: MetricType;
  value: number;
  unit: Unit;
  source: RecordSource;
  recordedAt?: Date;
  note?: string;
  meta?: RecordMeta;
};

function makeRecord(input: NewRecord): TrackingRecord {
  const at = input.recordedAt ?? new Date();
  const now = new Date().toISOString();
  return {
    id: newId(),
    userId: "local",
    metric: input.metric,
    value: Math.round(input.value * 10) / 10,
    unit: input.unit,
    source: input.source,
    recordedAt: at.toISOString(),
    localDate: dateKey(at),
    note: input.note,
    meta: input.meta,
    createdAt: now,
    updatedAt: now,
  };
}

export const progressStore = {
  addRecord(input: NewRecord): TrackingRecord | null {
    if (!Number.isFinite(input.value) || input.value <= 0) return null;
    const record = makeRecord(input);
    const db = load();
    save({ ...db, records: [...db.records, record] });
    return record;
  },

  updateRecord(id: string, value: number, meta?: RecordMeta) {
    if (!Number.isFinite(value) || value <= 0) return;
    const db = load();
    save({
      ...db,
      records: db.records.map((r) =>
        r.id === id
          ? {
              ...r,
              value: Math.round(value * 10) / 10,
              meta: meta ?? r.meta,
              source: "manual",
              updatedAt: new Date().toISOString(),
            }
          : r,
      ),
    });
  },

  deleteRecord(id: string): TrackingRecord | undefined {
    const db = load();
    const removed = db.records.find((r) => r.id === id);
    save({ ...db, records: db.records.filter((r) => r.id !== id), deleted: removed ? markDeleted(db.deleted, `rec:${id}`) : db.deleted });
    return removed;
  },

  /** One value per day (e.g. today's energy rating): replaces today's earlier answer. */
  setDailyValue(input: NewRecord) {
    if (!Number.isFinite(input.value) || input.value <= 0) return;
    const record = makeRecord(input);
    const db = load();
    const same = (r: TrackingRecord) => r.metric === record.metric && r.localDate === record.localDate;
    let deleted = db.deleted;
    for (const old of db.records.filter(same)) deleted = markDeleted(deleted, `rec:${old.id}`);
    save({ ...db, records: [...db.records.filter((r) => !same(r)), record], deleted });
  },

  setGoal(metric: MetricType, target: number, unit: Unit) {
    if (!Number.isFinite(target) || target <= 0) return;
    const db = load();
    const now = new Date().toISOString();
    const exists = db.goals.some((g) => g.metric === metric);
    save({
      ...db,
      goals: exists
        ? db.goals.map((g) => (g.metric === metric ? { ...g, target: Math.round(target), updatedAt: now } : g))
        : [...db.goals, { metric, target: Math.round(target), unit, period: "day", direction: "increase", updatedAt: now }],
    });
  },
};

export function goalFor(goals: Goal[], metric: MetricType): Goal | undefined {
  return goals.find((g) => g.metric === metric);
}

/** Used by account sync: read, replace or clear this phone's copy. */
export const progressSync = {
  get(): DB {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ready, ...db } = load();
    return db;
  },
  /** Data from his account: saved on the phone and shown, but not sent back again. */
  replace(db: DB) {
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
