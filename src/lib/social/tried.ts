"use client";

// What he did with the "do this" cards on Discover: tried it, found it useful, and the challenge
// he last picked at the top. Saved on this phone only (a light convenience, like a remembered filter).

import { useSyncExternalStore } from "react";
import type { ChallengeId } from "../content/types";

export type FeedFilter = ChallengeId | "all";

export interface TriedDB {
  /** contentId → when he tapped "I did it" */
  done: Record<string, string>;
  /** contentId → when he marked it useful */
  liked: Record<string, string>;
  filter: FeedFilter;
}

const KEY = "ms_tried_v1";
const EMPTY: TriedDB = { done: {}, liked: {}, filter: "all" };
const FILTERS: FeedFilter[] = ["all", "last", "hard", "her", "mixes", "train", "reset", "desire"];
let cache: TriedDB | null = null;
const listeners = new Set<() => void>();

const obj = (v: unknown): Record<string, string> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {});

function load(): TriedDB {
  if (cache) return cache;
  let db = EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<TriedDB>;
      db = { done: obj(p.done), liked: obj(p.liked), filter: FILTERS.includes(p.filter as FeedFilter) ? (p.filter as FeedFilter) : "all" };
    }
  } catch {
    // storage blocked: keep working in memory
  }
  cache = db;
  return cache;
}

function save(next: TriedDB) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

const toggle = (map: Record<string, string>, id: string) => {
  const next = { ...map };
  if (next[id]) delete next[id];
  else next[id] = new Date().toISOString();
  return next;
};

export const triedStore = {
  /** Returns true when it's now marked done. */
  toggleDone(id: string) {
    const db = load();
    save({ ...db, done: toggle(db.done, id) });
    return Boolean(load().done[id]);
  },
  toggleLike(id: string) {
    const db = load();
    save({ ...db, liked: toggle(db.liked, id) });
    return Boolean(load().liked[id]);
  },
  setFilter(filter: FeedFilter) {
    save({ ...load(), filter });
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useTried(): TriedDB & { ready: boolean } {
  const db = useSyncExternalStore(subscribe, load, () => EMPTY);
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  return { ...db, ready };
}
