"use client";

// How the page changes when he taps Social / Man / Me. Chosen on Me → Tab switching. Saved on this phone.

import { useSyncExternalStore } from "react";

export type TabTransition = "fade" | "instant" | "slide" | "frosted" | "reveal";

export const TAB_TRANSITIONS: { id: TabTransition; label: string; about: string }[] = [
  { id: "fade", label: "Fade", about: "The new page fades in and settles. Calm and quick." },
  { id: "instant", label: "Instant", about: "Switches straight away, like most iPhone apps." },
  { id: "slide", label: "Slide", about: "A short slide in from the side you're heading to." },
  { id: "frosted", label: "Frosted", about: "Glides in through frosted glass, like Discover ⇄ Community." },
  { id: "reveal", label: "Reveal", about: "The new page grows out in a circle from the tab you tapped." },
];

const KEY = "ms_tab_transition";
const listeners = new Set<() => void>();

export function readTabTransition(): TabTransition {
  try {
    const v = localStorage.getItem(KEY);
    return TAB_TRANSITIONS.some((t) => t.id === v) ? (v as TabTransition) : "fade";
  } catch {
    return "fade";
  }
}

export function setTabTransition(t: TabTransition) {
  try {
    if (t === "fade") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {}
  listeners.forEach((l) => l());
}

export function useTabTransition(): TabTransition {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readTabTransition,
    () => "fade",
  );
}
