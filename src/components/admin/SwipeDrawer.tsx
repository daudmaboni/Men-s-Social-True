"use client";

// The Studio menu on phones. It slides in from the left, and can be closed three ways — all with the same
// slide-out: drag it to the left (it follows the finger), tap the X, or tap the dimmed page beside it.
// Step 76: every move is a spring. Opening, closing and springing back can be caught by a finger at any
// moment, and a flick hands its speed straight to the spring. It leaves the way it came in (to the left).

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { animateSpring, project, releaseVelocity, rubberband, type SpringHandle } from "@/lib/motion/spring";

/** A sheet-like spring: Apple's drawer values (a hint of give after a flick). */
const OPEN = { damping: 1, response: 0.32 };
const AFTER_FLICK = { damping: 0.85, response: 0.3 };

export default function SwipeDrawer({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  /** Gets `close` so its own X button can use the same animation. */
  children: (close: () => void) => React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLButtonElement>(null);
  const x = useRef(0); // where the panel is now (0 = fully open, -width = gone)
  const spring = useRef<SpringHandle | null>(null);
  const closing = useRef(false);
  const drag = useRef<{ id: number; x: number; y: number; from: number; axis: "x" | "y" | null; samples: { t: number; x: number }[] } | null>(null);

  const width = () => panel.current?.offsetWidth ?? 288;

  /** Put the panel at `pos` and dim the page to match how open it is. */
  const place = useCallback((pos: number) => {
    x.current = pos;
    if (panel.current) panel.current.style.transform = `translateX(${pos}px)`;
    const shown = Math.max(0, Math.min(1, 1 + pos / (panel.current?.offsetWidth ?? 288)));
    if (scrim.current) scrim.current.style.opacity = String(shown);
  }, []);

  const springTo = useCallback(
    (target: number, velocity = 0, done?: () => void) => {
      spring.current?.stop();
      spring.current = animateSpring(x.current, target, place, {
        // A little give only when a flick throws it out; opening never overshoots (it would show a gap)
        ...(target < 0 && Math.abs(velocity) > 400 ? AFTER_FLICK : OPEN),
        velocity,
        onDone: () => {
          spring.current = null;
          done?.();
        },
      });
    },
    [place],
  );

  // Opening: it comes in from the left edge, from wherever it is
  useLayoutEffect(() => {
    if (!open) return;
    closing.current = false;
    place(-width());
    springTo(0);
    return () => spring.current?.stop();
  }, [open, place, springTo]);

  /** Slide out to the left (the way it came in), then really close. */
  const close = useCallback(
    (velocity = 0) => {
      closing.current = true;
      springTo(-width(), Math.min(velocity, 0), onClose);
    },
    [onClose, springTo],
  );
  const closeNow = useCallback(() => close(), [close]);

  // Escape closes too
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || !e.isPrimary) return;
    // Moving already (opening, closing, springing back)? His finger catches it where it is.
    const moving = !!spring.current?.running();
    if (moving) {
      spring.current?.stop();
      spring.current = null;
      closing.current = false;
    }
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: x.current, axis: moving ? "x" : null, samples: [{ t: performance.now(), x: e.clientX }] };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.axis) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      d.axis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
      if (d.axis === "y") {
        drag.current = null; // he's scrolling the menu
        return;
      }
    }
    // Follows the finger to the left; past fully open it resists more and more
    const pos = d.from + mx;
    place(pos > 0 ? rubberband(pos, width()) : pos);
    const now = performance.now();
    d.samples.push({ t: now, x: e.clientX });
    while (d.samples.length > 2 && now - d.samples[0].t > 100) d.samples.shift();
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || e.pointerId !== d.id) return;
    if (d.axis !== "x") {
      // A plain tap on a moving panel: let it finish where it was going
      if (!spring.current && x.current !== 0 && !closing.current) springTo(0);
      return;
    }
    const v = releaseVelocity(d.samples); // px per second, negative = towards closed
    // Where his movement was carrying it decides: closed if that point is past a third of the way
    const projected = x.current + project(v);
    if (v < -400 || projected < -width() / 3) close(v);
    else springTo(0, v);
  };

  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={label}>
      <button ref={scrim} className="absolute inset-0 bg-black/40" style={{ opacity: 0 }} aria-label="Close menu" onClick={closeNow} />
      <div
        ref={panel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl will-change-transform"
        style={{ transform: "translateX(-100%)", touchAction: "pan-y" }}
      >
        {children(closeNow)}
        {/* A small handle on the edge hints that it can be dragged */}
        <span className="pointer-events-none absolute right-1.5 top-1/2 h-10 w-1 -translate-y-1/2 rounded-full bg-line" aria-hidden />
      </div>
    </div>
  );
}
