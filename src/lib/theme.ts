"use client";

// Light / dark appearance. "auto" follows the phone's own setting.
// Saved on this phone as "ms_theme". The page reads it before it paints (see app/layout.tsx), so there's no flash.

import { useSyncExternalStore } from "react";

export type ThemePref = "light" | "dark" | "auto";
export type Theme = "light" | "dark";
/** Colour modes. Green is Kayani's own colour and the default. */
export type Accent = "green" | "blue" | "red";
export const ACCENTS: { id: Accent; label: string; swatch: string }[] = [
  { id: "green", label: "Green", swatch: "#029046" },
  { id: "blue", label: "Blue", swatch: "#1e5bb8" },
  { id: "red", label: "Red", swatch: "#b3263a" },
];
const ACCENT_KEY = "ms_accent";

const KEY = "ms_theme";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function resolve(pref: ThemePref, systemDark: boolean): Theme {
  return pref === "auto" ? (systemDark ? "dark" : "light") : pref;
}

const systemDark = () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

function apply(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  syncBrowserBar();
}

/** The phone's top bar takes the app's colour. */
function syncBrowserBar() {
  const css = getComputedStyle(document.documentElement);
  const dark = document.documentElement.dataset.theme === "dark";
  const color = css.getPropertyValue(dark ? "--a-bg-dark" : "--a-forest").trim();
  if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
}

export function readAccent(): Accent {
  try {
    const v = localStorage.getItem(ACCENT_KEY);
    return v === "blue" || v === "red" ? v : "green";
  } catch {
    return "green";
  }
}

/** Change the colour mode (Green, Blue, Red). Spreads in a circle from the tapped point, like the theme. */
export function setAccent(accent: Accent, from?: { x: number; y: number }) {
  try {
    if (accent === "green") localStorage.removeItem(ACCENT_KEY);
    else localStorage.setItem(ACCENT_KEY, accent);
  } catch {}
  const change = () => {
    if (accent === "green") delete document.documentElement.dataset.accent;
    else document.documentElement.dataset.accent = accent;
    syncBrowserBar();
  };
  withCircle(change, from);
  notify();
}

export function useAccent(): Accent {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readAccent,
    () => "green",
  );
}

/** Runs a visual change inside a circular reveal from `from` (when the phone supports it). */
function withCircle(change: () => void, from?: { x: number; y: number }) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition || reduce) return change();
  const x = from?.x ?? window.innerWidth / 2;
  const y = from?.y ?? window.innerHeight / 2;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  doc
    .startViewTransition(change)
    .ready.then(() =>
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 550, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
      ),
    )
    .catch(() => {});
}

/**
 * Change the appearance. With `from` (a point on screen), the new look spreads out in a circle
 * from that point, on phones that support it; otherwise it simply switches.
 */
export function setThemePref(pref: ThemePref, from?: { x: number; y: number }) {
  try {
    if (pref === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {}
  const next = resolve(pref, systemDark());
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  if (next === current) apply(next);
  else withCircle(() => apply(next), from);
  notify();
}

/** Keep "auto" in step when the phone switches between light and dark by itself. */
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (readPref() === "auto") {
      apply(resolve("auto", systemDark()));
      notify();
    }
  });
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readPref,
    () => "auto",
  );
}

/** Pinch gesture: did the two fingers spread apart (→ dark) or come together (→ light)? */
export function pinchResult(startDistance: number, endDistance: number): Theme | null {
  if (startDistance < 30) return null; // fingers started too close to measure
  const ratio = endDistance / startDistance;
  if (ratio > 1.4) return "dark";
  if (ratio < 0.7) return "light";
  return null;
}
