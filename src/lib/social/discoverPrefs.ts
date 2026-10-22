"use client";

// What Discover needs on the phone (Step 71):
//  - the visit seed: his phone (or account) + this visit, so cards change every visit and differ between men,
//  - his habits: reels watched or skipped, cards used — only counts, kept on this phone,
//  - the Discover settings staff set in Studio → Discover (app_settings "discover_config").

import { useEffect, useSyncExternalStore } from "react";
import { getSupabase } from "../supabase/client";
import { DEFAULT_DISCOVER, NO_HABITS, normalizeDiscover, type DiscoverConfig, type Habits } from "../content/discover";

const DEVICE = "ms_device_id";
const VISIT = "ms_feed_visit";
const HABITS = "ms_habits_v1";
const CFG = "ms_discover_cfg";
/** A visit ends after this long away from Discover; the next one gets a new order. */
const VISIT_GAP_MS = 45 * 60_000;

const rnd = () => Math.random().toString(36).slice(2, 10);

function read<T>(key: string, store: Storage | undefined, fallback: T): T {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, store: Storage | undefined, value: unknown) {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {}
}
const local = () => (typeof window === "undefined" ? undefined : window.localStorage);
const session = () => (typeof window === "undefined" ? undefined : window.sessionStorage);

/** The seed for this visit. Same while he keeps using Discover; new after a break or on a new open. */
export function visitSeed(accountId?: string | null): string {
  let device = read<string>(DEVICE, local(), "");
  if (!device) {
    device = rnd() + rnd();
    write(DEVICE, local(), device);
  }
  const now = Date.now();
  let v = read<{ id: string; at: number } | null>(VISIT, session(), null);
  if (!v || now - v.at > VISIT_GAP_MS) v = { id: rnd(), at: now };
  write(VISIT, session(), { ...v, at: now });
  return `${accountId || device}:${v.id}`;
}

/* ───────── Habits (counts only) ───────── */
let habits: Habits | null = null;
const hListeners = new Set<() => void>();
const getHabits = () => (habits ??= { ...NO_HABITS, ...read<Partial<Habits>>(HABITS, local(), {}) });
function bump(change: Partial<Habits>) {
  const h = getHabits();
  habits = {
    reelViews: h.reelViews + (change.reelViews ?? 0),
    reelFinished: h.reelFinished + (change.reelFinished ?? 0),
    reelSkipped: h.reelSkipped + (change.reelSkipped ?? 0),
    cardActions: h.cardActions + (change.cardActions ?? 0),
  };
  // Older habits count less as time goes on: halve everything once the total gets big
  const total = habits.reelViews + habits.cardActions;
  if (total > 400) habits = { reelViews: habits.reelViews / 2, reelFinished: habits.reelFinished / 2, reelSkipped: habits.reelSkipped / 2, cardActions: habits.cardActions / 2 };
  write(HABITS, local(), habits);
  hListeners.forEach((l) => l());
}

export const habitsStore = {
  get: getHabits,
  /** He left a reel: how long he watched it decides what it tells us. */
  reelWatched(seconds: number, fraction: number) {
    bump({ reelViews: 1, reelFinished: fraction >= 0.8 ? 1 : 0, reelSkipped: seconds < 3 && fraction < 0.5 ? 1 : 0 });
  },
  /** He used a card: swiped its steps, saved it, marked it useful, did it, or opened the full page. */
  cardUsed() {
    bump({ cardActions: 1 });
  },
};

/* ───────── Discover settings from the Studio ───────── */
let cfg: DiscoverConfig | null = null;
const cListeners = new Set<() => void>();
let fetched = false;

function getCfg(): DiscoverConfig {
  return (cfg ??= normalizeDiscover(read<unknown>(CFG, local(), DEFAULT_DISCOVER)));
}

async function fetchCfg() {
  if (fetched) return;
  fetched = true;
  const sb = getSupabase();
  if (!sb) return;
  const { data } = await sb.from("app_settings").select("value").eq("key", "discover_config").maybeSingle();
  const next = normalizeDiscover(data?.value ?? DEFAULT_DISCOVER);
  cfg = next;
  write(CFG, local(), next);
  cListeners.forEach((l) => l());
}

export function useDiscoverConfig(): DiscoverConfig {
  const value = useSyncExternalStore(
    (cb) => {
      cListeners.add(cb);
      return () => cListeners.delete(cb);
    },
    getCfg,
    () => DEFAULT_DISCOVER,
  );
  useEffect(() => {
    void fetchCfg();
  }, []);
  return value;
}
