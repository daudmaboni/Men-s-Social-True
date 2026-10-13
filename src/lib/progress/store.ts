"use client";

// Saves progress records and goals.
// NOW: on the phone (localStorage) so it works before sign-up.
// LATER: this file is swapped for Supabase — the screens don't change.

import { useSyncExternalStore } from "react";
import { dateKey } from "./dates";
import type { Goal, MetricType, RecordMeta, RecordSource, TrackingRecord, Unit } from "./types";

const KEY = "ms_progress_v1";

type DB = { records: TrackingRecord[]; goals: Goal[] };
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

const SERVER_STATE: ProgressState = { records: [], goals: DEFAULT_GOALS, ready: false };
let cache: ProgressState | null = null;
const listeners = new Set<() => void>();

function load(): ProgressState {
  if (cache) return cache;
  let db: DB = { records: [], goals: DEFAULT_GOALS };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DB>;
      db = {
        records: Array.isArray(parsed.records) ? parsed.records : [],
        goals: withDefaults(Array.isArray(parsed.goals) ? parsed.goals : []),
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
    save({ records: [...db.records, record], goals: db.goals });
    return record;
  },

  updateRecord(id: string, value: number, meta?: RecordMeta) {
    if (!Number.isFinite(value) || value <= 0) return;
    const db = load();
    save({
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
      goals: db.goals,
    });
  },

  deleteRecord(id: string): TrackingRecord | undefined {
    const db = load();
    const removed = db.records.find((r) => r.id === id);
    save({ records: db.records.filter((r) => r.id !== id), goals: db.goals });
    return removed;
  },

  /** One value per day (e.g. today's energy rating): replaces today's earlier answer. */
  setDailyValue(input: NewRecord) {
    if (!Number.isFinite(input.value) || input.value <= 0) return;
    const record = makeRecord(input);
    const db = load();
    save({
      records: [
        ...db.records.filter((r) => !(r.metric === record.metric && r.localDate === record.localDate)),
        record,
      ],
      goals: db.goals,
    });
  },

  setGoal(metric: MetricType, target: number, unit: Unit) {
    if (!Number.isFinite(target) || target <= 0) return;
    const db = load();
    const now = new Date().toISOString();
    const exists = db.goals.some((g) => g.metric === metric);
    save({
      records: db.records,
      goals: exists
        ? db.goals.map((g) => (g.metric === metric ? { ...g, target: Math.round(target), updatedAt: now } : g))
        : [...db.goals, { metric, target: Math.round(target), unit, period: "day", direction: "increase", updatedAt: now }],
    });
  },
};

export function goalFor(goals: Goal[], metric: MetricType): Goal | undefined {
  return goals.find((g) => g.metric === metric);
}
