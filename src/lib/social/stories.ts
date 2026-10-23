"use client";

// Real men's stories on Discover (Step 86). Only stories a man agreed to share (Me → Tell us → "you may
// share this"), written up by staff without his name, and published in Studio → Stories.
// Also: "N men said this helped" counts (helped_counts, migration 0019). Both are read once per app open
// and kept on the phone, so Discover works offline.

import { useEffect, useSyncExternalStore } from "react";
import { getSupabase } from "../supabase/client";
import type { ChallengeId } from "../content/types";
import { isCircle } from "../content/circles";

export interface Story {
  id: string;
  text: string;
  textSw: string;
  /** "A man, 34, Dar es Salaam": never a name. */
  who: string;
  whoSw: string;
  circle: ChallengeId | null;
  publishedAt: string;
}

type Row = { id: string; text_en: string | null; text_sw: string | null; who_en: string | null; who_sw: string | null; circle: string | null; published_at: string | null };

export function rowToStory(r: Row): Story | null {
  const text = (r.text_en || r.text_sw || "").trim();
  const textSw = (r.text_sw || r.text_en || "").trim();
  if (!text) return null;
  return {
    id: r.id,
    text,
    textSw,
    who: (r.who_en || r.who_sw || "A man in the app").trim(),
    whoSw: (r.who_sw || r.who_en || "Mwanaume kwenye app").trim(),
    circle: r.circle && isCircle(r.circle) ? r.circle : null,
    publishedAt: r.published_at ?? "",
  };
}

/** The story for spot `n` of the feed this visit: stories of the circle he's in first, then the rest. */
export function storyFor(stories: Story[], n: number, circle: ChallengeId | null, seedNum: number): Story | null {
  if (!stories.length) return null;
  const here = circle ? stories.filter((s) => s.circle === circle) : [];
  const list = here.length ? [...here, ...stories.filter((s) => s.circle !== circle)] : stories;
  return list[(seedNum + n) % list.length] ?? null;
}

const KEY = "ms_stories_v1";
const COUNTS = "ms_helped_counts_v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

type State = { stories: Story[]; counts: Record<string, number> };
const EMPTY: State = { stories: [], counts: {} };
let state: State | null = null;
const listeners = new Set<() => void>();
let fetched = false;

const get = (): State => (state ??= typeof window === "undefined" ? EMPTY : { stories: read<Story[]>(KEY, []), counts: read<Record<string, number>>(COUNTS, {}) });

async function fetchAll() {
  if (fetched) return;
  fetched = true;
  const sb = getSupabase();
  if (!sb) return;
  const [s, c] = await Promise.all([
    sb.from("men_stories").select("id,text_en,text_sw,who_en,who_sw,circle,published_at").eq("status", "published").order("published_at", { ascending: false }).limit(60),
    sb.rpc("helped_counts"),
  ]).catch(() => [null, null] as const);
  const next = { ...get() };
  if (s && !s.error && Array.isArray(s.data)) {
    next.stories = (s.data as Row[]).map(rowToStory).filter((x): x is Story => Boolean(x));
    write(KEY, next.stories);
  }
  if (c && !c.error && c.data && typeof c.data === "object") {
    const counts: Record<string, number> = {};
    for (const [k, v] of Object.entries(c.data as Record<string, unknown>)) if (typeof v === "number" && v > 0) counts[k] = v;
    next.counts = counts;
    write(COUNTS, counts);
  }
  state = next;
  listeners.forEach((l) => l());
}

/** Published stories and helped counts (from the phone at once, then fresh from the server). */
export function useStories(): State {
  const v = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    get,
    () => EMPTY,
  );
  useEffect(() => {
    void fetchAll();
  }, []);
  return v;
}

/** The number to show under a card, or null when it's below the Studio's minimum. His own heart counts too. */
export function helpedShown(count: number | undefined, mine: boolean, min: number): number | null {
  if (min <= 0) return null;
  const n = Math.max(count ?? 0, mine ? 1 : 0);
  return n >= min ? n : null;
}
