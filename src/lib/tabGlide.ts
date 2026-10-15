"use client";

// One movement for changing tabs, whether he swipes or taps Social / Man / Me:
// the whole strip glides to the new tab in about 0.28 s (quick at first, then easing into place).
// We move it ourselves instead of leaving it to the browser's snap, which is slow on many phones.

export const GLIDE_MS = 280;

let anim = 0;
let gliding = false;
let restoreSnap: (() => void) | null = null;

const ease = (t: number) => 1 - Math.pow(1 - t, 3); // ease-out cubic
const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Stop a glide where it is (e.g. his finger touched the screen again). */
export function cancelGlide() {
  if (anim) cancelAnimationFrame(anim);
  anim = 0;
  gliding = false;
}

export const isGliding = () => gliding;

/** Turn the browser's snapping off while we move the strip; it comes back when the glide ends. */
export function holdSnap(el: HTMLElement) {
  if (!restoreSnap) {
    el.style.scrollSnapType = "none";
    restoreSnap = () => {
      el.style.scrollSnapType = "";
      restoreSnap = null;
    };
  }
}

/** Glide the strip to `left` (in px). Going two tabs takes a little longer, so it never feels rushed. */
export function glideTo(el: HTMLElement, left: number, onDone?: () => void) {
  cancelGlide();
  const from = el.scrollLeft;
  const distance = left - from;
  if (Math.abs(distance) < 1 || reduceMotion()) {
    holdSnap(el);
    el.scrollLeft = left;
    restoreSnap?.();
    onDone?.();
    return;
  }
  holdSnap(el);
  gliding = true;
  const pages = Math.abs(distance) / Math.max(el.clientWidth, 1);
  const ms = GLIDE_MS + Math.max(0, pages - 1) * 80;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    el.scrollLeft = from + distance * ease(t);
    if (t < 1) {
      anim = requestAnimationFrame(step);
    } else {
      anim = 0;
      gliding = false;
      el.scrollLeft = left;
      restoreSnap?.();
      onDone?.();
    }
  };
  anim = requestAnimationFrame(step);
}

/**
 * Where a swipe should land, from how far he dragged and how fast he let go.
 * A quick flick changes tab even if short; a slow drag needs to pass halfway; otherwise it springs back.
 */
export function landingTab({ startTab, dragPx, width, velocity, count }: { startTab: number; dragPx: number; width: number; velocity: number; count: number }): number {
  const FLICK = 0.35; // px per ms
  let to = startTab;
  if (Math.abs(velocity) > FLICK) to = startTab + (velocity > 0 ? 1 : -1);
  else if (Math.abs(dragPx) > width / 2) to = startTab + (dragPx > 0 ? 1 : -1);
  return Math.min(Math.max(to, 0), count - 1);
}
