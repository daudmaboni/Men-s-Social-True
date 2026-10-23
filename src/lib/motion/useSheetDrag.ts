"use client";

// Pull a sheet down to close it (Step 77), like WhatsApp and Instagram.
// The pull only starts when nothing inside the sheet can scroll up any more, so reading a long list still
// scrolls normally; once the list is at its top, pulling further drags the whole sheet down with the finger.
// Touch events (not pointer events) because the browser owns vertical swipes; when the pull is ours we stop it.

import { useEffect } from "react";
import { releaseVelocity, rubberband } from "./spring";

/** Is there anything between the touched element and the sheet that is scrolled down (so it should scroll first)? */
function scrolledAbove(target: EventTarget | null, sheet: HTMLElement): boolean {
  let el = target as HTMLElement | null;
  while (el && el !== sheet.parentElement) {
    if (el.scrollTop > 0) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") return true;
    }
    if (el === sheet) break;
    el = el.parentElement;
  }
  return false;
}

export function useSheetDrag(
  ref: React.RefObject<HTMLElement | null>,
  {
    enabled,
    onDrag,
    onRelease,
  }: {
    enabled: boolean;
    /** How far down the sheet is pulled now (px; a pull upwards stretches a little and gives negative values). */
    onDrag: (y: number) => void;
    /** He let go: how far it was pulled and how fast it was moving (px/s, positive = down). */
    onRelease: (y: number, velocity: number) => void;
  },
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let g: { y0: number; x0: number; on: boolean; off: boolean; target: EventTarget | null; samples: { t: number; x: number }[]; y: number } | null = null;
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1) return void (g = null);
      // Typing in a box, or moving a slider: leave it alone
      const tag = (e.target as HTMLElement)?.closest?.("input[type=range], [data-no-sheet-drag]");
      if (tag) return void (g = null);
      const p = e.touches[0];
      g = { y0: p.clientY, x0: p.clientX, on: false, off: false, target: e.target, samples: [{ t: performance.now(), x: p.clientY }], y: 0 };
    };
    const move = (e: TouchEvent) => {
      if (!g || g.off) return;
      const p = e.touches[0];
      const dy = p.clientY - g.y0;
      const dx = p.clientX - g.x0;
      if (!g.on) {
        if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
        if (dy > 0 && dy > Math.abs(dx) && !scrolledAbove(g.target, el)) {
          g.on = true;
          g.y0 = p.clientY; // start from here, so the sheet doesn't jump by the first few pixels
          (document.activeElement as HTMLElement | null)?.blur?.(); // the keyboard goes away as he pulls
        } else return void (g.off = true);
      }
      if (e.cancelable) e.preventDefault();
      const y = p.clientY - g.y0;
      g.y = y >= 0 ? y : rubberband(y, el.offsetHeight || 400, 0.2);
      onDrag(g.y);
      const now = performance.now();
      g.samples.push({ t: now, x: p.clientY });
      while (g.samples.length > 2 && now - g.samples[0].t > 100) g.samples.shift();
    };
    const end = () => {
      if (!g?.on) return void (g = null);
      const v = releaseVelocity(g.samples);
      const y = g.y;
      g = null;
      onRelease(y, v);
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [ref, enabled, onDrag, onRelease]);
}

/** Should a pull of `y` px at `velocity` px/s close a sheet `height` px tall? */
export function pullCloses(y: number, velocity: number, height: number): boolean {
  if (velocity > 500) return true;
  if (velocity < -300) return false; // flicked back up
  return y + velocity * 0.12 > height * 0.3;
}
