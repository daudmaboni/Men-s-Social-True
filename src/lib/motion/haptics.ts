"use client";

// Short phone vibrations on the moments that matter (Step 77), fired on the same frame as the animation.
// - Works on Android phones (most of our men). iPhones have no vibration for web pages, so it simply does nothing.
// - Used sparingly: done, points arriving, a lesson finished, a new level, a pull that refreshes, closing a reel.
// - He can switch it off in Me → Settings ("Vibration"), saved on this phone.

import { useSyncExternalStore } from "react";

const KEY = "ms_haptics";

export type HapticKind = "tick" | "done" | "success" | "level";

/** Vibration patterns in milliseconds (vibrate, pause, vibrate…). Kept short so they feel like a tap, not an alarm. */
export const PATTERNS: Record<HapticKind, number | number[]> = {
  tick: 8, // a small snap: a reel closing, a swipe committing, a pull reaching "refresh"
  done: 14, // he did something: Done, I did it
  success: [12, 50, 22], // a lesson finished, points arriving
  level: [18, 40, 18, 40, 48], // a new level
};

const listeners = new Set<() => void>();

export function hapticsOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function setHapticsOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
  listeners.forEach((l) => l());
  if (on) haptic("done");
}

/** The phone can vibrate for web pages at all (false on iPhones and computers). */
export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

let last = 0;
/** Vibrate once. Never twice within 60 ms, so two things finishing together don't buzz on top of each other. */
export function haptic(kind: HapticKind = "tick") {
  if (!canVibrate() || !hapticsOn()) return;
  const now = Date.now();
  if (now - last < 60) return;
  last = now;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {}
}

export function useHapticsOn(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    hapticsOn,
    () => true,
  );
}
