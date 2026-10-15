"use client";

// The Studio menu on phones. It slides in from the left, and can be closed three ways — all with the same
// slide-out: drag it to the left (it follows the finger), tap the X, or tap the dimmed page beside it.
// A short quick flick is enough; a slow drag must pass about a third of the way, otherwise it springs back.

import { useCallback, useEffect, useRef, useState } from "react";

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
  const [dx, setDx] = useState(0); // how far it's been dragged left (≤ 0)
  const [phase, setPhase] = useState<"in" | "drag" | "settle" | "out">("in");
  const drag = useRef<{ id: number; x: number; y: number; axis: "x" | "y" | null; samples: { t: number; x: number }[] } | null>(null);

  useEffect(() => {
    if (open) {
      setDx(0);
      setPhase("in");
    }
  }, [open]);

  const width = () => panel.current?.offsetWidth ?? 288;

  /** Slide out, then really close. */
  const close = useCallback(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return onClose();
    setPhase("out");
    setDx(-width());
  }, [onClose]);

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
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: null, samples: [{ t: performance.now(), x: e.clientX }] };
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
      setPhase("drag");
    }
    // Follows the finger to the left; a little resistance to the right
    setDx(mx < 0 ? mx : mx / 6);
    const now = performance.now();
    d.samples.push({ t: now, x: e.clientX });
    while (d.samples.length > 2 && now - d.samples[0].t > 100) d.samples.shift();
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || e.pointerId !== d.id || d.axis !== "x") return;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const v = last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0; // px per ms
    if (v < -0.4 || dx < -width() / 3) close();
    else {
      setPhase("settle");
      setDx(0);
    }
  };

  // How open it is, 0..1 — the dimmed background follows it
  const shown = Math.max(0, Math.min(1, 1 + dx / width()));
  const moving = phase === "drag" ? "none" : "transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1)";

  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={label}>
      <button
        className="absolute inset-0 bg-black/40"
        style={{ opacity: shown, transition: phase === "drag" ? "none" : "opacity 0.26s ease-out" }}
        aria-label="Close menu"
        onClick={close}
      />
      <div
        ref={panel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTransitionEnd={(e) => e.target === panel.current && phase === "out" && onClose()}
        onAnimationEnd={(e) => e.target === panel.current && phase === "in" && setPhase("settle")}
        className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl ${phase === "in" ? "drawer-in" : ""}`}
        style={{ transform: `translateX(${dx}px)`, transition: phase === "in" ? undefined : moving, touchAction: "pan-y" }}
      >
        {children(close)}
        {/* A small handle on the edge hints that it can be dragged */}
        <span className="pointer-events-none absolute right-1.5 top-1/2 h-10 w-1 -translate-y-1/2 rounded-full bg-line" aria-hidden />
      </div>
    </div>
  );
}
