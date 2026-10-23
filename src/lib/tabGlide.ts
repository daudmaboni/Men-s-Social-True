"use client";

// One movement for changing tabs, whether he swipes or taps Social / Man / Me.
// Since Step 76 it is a spring (src/lib/motion/spring.ts), not a fixed 0.28 s curve:
// - after a swipe, the strip keeps the exact speed of his finger, so there is no seam between drag and glide
// - a tap glides there in about a fifth of a second and settles without bouncing
// - a finger touching the screen mid-glide catches the strip right where it is
// We move it ourselves instead of leaving it to the browser's snap, which is slow on many phones.

import { animateSpring, project, type SpringHandle } from "./motion/spring";

/** Spring for the tab strip: no bounce (a bounce would show a sliver of the next tab), quick response. */
export const TAB_SPRING = { damping: 1, response: 0.32 };

let current: SpringHandle | null = null;
let restoreSnap: (() => void) | null = null;

/** Stop a glide where it is (e.g. his finger touched the screen again). */
export function cancelGlide() {
  current?.stop();
  current = null;
}

export const isGliding = () => !!current?.running();

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

/** Give snapping back to the browser (after we moved the strip some other way). */
export function releaseSnap() {
  restoreSnap?.();
}

/**
 * Glide the strip to `left` (px). `velocity` is how fast the strip was already moving, in px per second
 * (positive = towards the tabs on the right); leave it out for a tap.
 */
export function glideTo(el: HTMLElement, left: number, onDone?: () => void, velocity = 0) {
  cancelGlide();
  holdSnap(el);
  current = animateSpring(
    el.scrollLeft,
    left,
    (v) => {
      el.scrollLeft = v;
    },
    {
      ...TAB_SPRING,
      velocity,
      onDone: () => {
        current = null;
        el.scrollLeft = left;
        restoreSnap?.();
        onDone?.();
      },
    },
  );
}

/**
 * Where a swipe should land, from how far he dragged (px) and how fast he let go (px per ms).
 * - A quick flick goes to the next tab in the direction of the flick, counted from where the page is now.
 *   So a flick back towards where he started returns him there, even after a long drag.
 * - Otherwise the page goes where his movement was carrying it (a short projection of his speed),
 *   to whichever tab that point is nearest.
 * - Never more than one tab per swipe.
 */
export function landingTab({ startTab, dragPx, width, velocity, count }: { startTab: number; dragPx: number; width: number; velocity: number; count: number }): number {
  const FLICK = 0.35; // px per ms
  const pos = startTab + dragPx / Math.max(width, 1);
  let to: number;
  if (Math.abs(velocity) > FLICK) {
    to = velocity > 0 ? Math.ceil(pos - 0.001) : Math.floor(pos + 0.001);
    if (to === startTab && Math.abs(dragPx) < 2) to = startTab + (velocity > 0 ? 1 : -1);
  } else {
    to = Math.round(startTab + (dragPx + project(velocity * 1000)) / Math.max(width, 1));
  }
  to = Math.min(Math.max(to, startTab - 1), startTab + 1);
  return Math.min(Math.max(to, 0), count - 1);
}
