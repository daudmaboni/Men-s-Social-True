// Reels in the Discover feed (Step 73): only ONE plays at a time, like Instagram.
// Each reel tells this store how much of it is on screen. The one most on screen (at least 60%)
// plays; the others pause. Nothing plays while the full-screen viewer is open or the app is hidden.

import { useSyncExternalStore } from "react";

export const PLAY_AT = 0.6;

/** Which reel should play: the most visible one at or above PLAY_AT. On a tie, the one already playing keeps going. */
export function pickPlaying(ratios: ReadonlyMap<string, number>, current: string | null, blocked: boolean): string | null {
  if (blocked) return null;
  let best: string | null = null;
  let bestRatio = PLAY_AT;
  for (const [id, r] of ratios) {
    if (r < PLAY_AT) continue;
    if (best === null || r > bestRatio || (r === bestRatio && id === current)) {
      best = id;
      bestRatio = r;
    }
  }
  return best;
}

const ratios = new Map<string, number>();
const subs = new Set<() => void>();
let playing: string | null = null;
let viewerOpen = false;
let hidden = false;
let soundOn = false;
let listening = false;

function update() {
  const next = pickPlaying(ratios, playing, viewerOpen || hidden);
  if (next === playing) return;
  playing = next;
  subs.forEach((f) => f());
}

function listen() {
  if (listening || typeof document === "undefined") return;
  listening = true;
  hidden = document.hidden;
  document.addEventListener("visibilitychange", () => {
    hidden = document.hidden;
    update();
  });
}

export const feedPlayer = {
  /** A reel reports how much of it is on screen (0–1). */
  report(id: string, ratio: number) {
    listen();
    if (ratio > 0) ratios.set(id, ratio);
    else ratios.delete(id);
    update();
  },
  leave(id: string) {
    ratios.delete(id);
    update();
  },
  setViewerOpen(open: boolean) {
    viewerOpen = open;
    update();
  },
  /** Sound in the feed is shared: unmuting one reel keeps sound on for the next, like Instagram. */
  sound: () => soundOn,
  setSound(on: boolean) {
    soundOn = on;
    subs.forEach((f) => f());
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => subs.delete(f);
  },
};

export function usePlayingReel(): string | null {
  return useSyncExternalStore(feedPlayer.subscribe, () => playing, () => null);
}

export function useFeedSound(): boolean {
  return useSyncExternalStore(feedPlayer.subscribe, () => soundOn, () => false);
}
