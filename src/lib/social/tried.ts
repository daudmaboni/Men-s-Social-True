"use client";

// What he did with the "do this" cards on Discover: tried it, found it useful, and the challenge
// he last picked at the top.
// Step 79: "I did it" now lives in his record (feed store → his account, on all his phones) and earns
// TRIED_POINTS the first time. "Useful" and the chosen challenge stay on this phone (light conveniences).
// Cards marked done here before Step 79 are moved into his record once.

import { useSyncExternalStore } from "react";
import type { ChallengeId } from "../content/types";
import { feedStore, useFeed } from "../feed/store";

/** Points for doing a Discover card, the first time (Step 79). */
export const TRIED_POINTS = 10;
const MOVED = "ms_tried_moved_v1";

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
  moveOldDone(db);
  return cache;
}

/** Once per phone: hand "I did it" marks saved here before Step 79 to his record. */
function moveOldDone(db: TriedDB) {
  if (typeof window === "undefined" || !Object.keys(db.done).length) return;
  try {
    if (localStorage.getItem(MOVED) === "1") return;
    localStorage.setItem(MOVED, "1");
  } catch {
    return;
  }
  const old = db.done;
  // After this render pass (the feed store may be saving right now)
  setTimeout(() => {
    feedStore.importTried(old, TRIED_POINTS);
    save({ ...load(), done: {} });
  }, 0);
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
  /** "I did it" (or taking it back). Returns true when it's now marked done. Saved to his record (Step 79). */
  toggleDone(id: string, isDone: boolean) {
    if (isDone) {
      feedStore.unmarkTried(id);
      return false;
    }
    feedStore.markTried(id, TRIED_POINTS);
    return true;
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
  const feed = useFeed();
  // "I did it" comes from his record (id → when), so it's the same on all his phones
  const done: Record<string, string> = {};
  for (const [id, x] of Object.entries(feed.tried ?? {})) done[id] = x.at;
  return { ...db, done, ready: ready && feed.ready };
}
