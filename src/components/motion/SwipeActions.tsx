"use client";

// A row he can swipe (Step 77): right for one action (Done), left for another (Later).
// - The row follows his finger 1:1; the action's colour and icon show underneath as it moves.
// - Past the point of no return the icon grows and the phone gives a small tick, so he knows letting go will do it.
// - Let go: a flick or a long enough drag throws the row off in that direction at his finger's speed, then the
//   action happens. Otherwise it springs back. An action that isn't available on that side only stretches.
// - The tab pager ignores this row (data-own-swipe), and up/down scrolling still works (touch-action: pan-y).
// The buttons inside the row keep working as before; swiping is a faster way, not the only way.

import { useRef } from "react";
import { animateSpring, project, releaseVelocity, rubberband, type SpringHandle } from "@/lib/motion/spring";
import { haptic } from "@/lib/motion/haptics";

type Side = { label: string; icon: React.ReactNode; className: string; onCommit: () => void };

export default function SwipeActions({
  right,
  left,
  disabled,
  children,
}: {
  /** Swiping right (finger moves right) */
  right?: Side;
  /** Swiping left */
  left?: Side;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const row = useRef<HTMLDivElement>(null);
  const under = useRef<HTMLDivElement>(null);
  const x = useRef(0);
  const anim = useRef<SpringHandle | null>(null);
  const armed = useRef<"right" | "left" | null>(null);
  const drag = useRef<{ id: number; x0: number; y0: number; from: number; axis: "x" | "y" | null; samples: { t: number; x: number }[] } | null>(null);

  const width = () => row.current?.offsetWidth ?? 320;
  const reach = () => Math.min(140, width() * 0.38); // past this, letting go does it

  const place = (v: number) => {
    x.current = v;
    if (row.current) row.current.style.transform = v ? `translate3d(${v}px,0,0)` : "";
    const u = under.current;
    if (!u) return;
    const side = v > 0 ? "right" : v < 0 ? "left" : "";
    u.dataset.side = side;
    u.style.opacity = String(Math.min(1, Math.abs(v) / 40));
    const on = Math.abs(v) >= reach();
    u.dataset.armed = on ? "1" : "0";
    const now = on ? (side as "right" | "left") : null;
    if (now !== armed.current) {
      if (now) haptic("tick");
      armed.current = now;
    }
  };

  const springTo = (to: number, velocity: number, done?: () => void) => {
    anim.current?.stop();
    anim.current = animateSpring(x.current, to, place, {
      damping: 1,
      response: 0.3,
      velocity,
      onDone: () => {
        anim.current = null;
        done?.();
      },
    });
  };

  if (disabled || (!right && !left)) return <>{children}</>;

  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || !e.isPrimary) return;
    const moving = !!anim.current?.running();
    anim.current?.stop();
    anim.current = null;
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, from: x.current, axis: moving ? "x" : null, samples: [{ t: performance.now(), x: e.clientX }] };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.axis) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.axis === "y") return void (drag.current = null);
      try {
        row.current?.setPointerCapture(e.pointerId);
      } catch {}
    }
    let v = d.from + dx;
    // A side with no action only stretches
    if ((v > 0 && !right) || (v < 0 && !left)) v = rubberband(v, width(), 0.25);
    place(v);
    const now = performance.now();
    d.samples.push({ t: now, x: e.clientX });
    while (d.samples.length > 2 && now - d.samples[0].t > 100) d.samples.shift();
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || d.axis !== "x") return;
    const v = releaseVelocity(d.samples);
    const at = x.current + project(v);
    const side = at > 0 ? right : left;
    const dir = at > 0 ? 1 : -1;
    // The flick must point the same way the row is pulled (a flick back cancels)
    const sameWay = Math.sign(v || x.current) === Math.sign(x.current);
    if (side && sameWay && (Math.abs(at) >= reach() || Math.abs(v) > 700)) {
      haptic("done");
      springTo(dir * (width() + 24), v, () => {
        side.onCommit();
        armed.current = null;
        place(0); // the row comes back in its new state (done / later), with Undo
      });
    } else springTo(0, v);
  };

  return (
    <div className="swipe-actions relative overflow-hidden rounded-2xl">
      <div ref={under} className="swipe-under pointer-events-none absolute inset-0 flex items-center justify-between rounded-2xl px-5" aria-hidden data-side="" style={{ opacity: 0 }}>
        <span className={`swipe-under-right flex items-center gap-2 text-sm font-bold ${right?.className ?? ""}`}>
          <span className="swipe-icon">{right?.icon}</span>
          {right?.label}
        </span>
        <span className={`swipe-under-left flex items-center gap-2 text-sm font-bold ${left?.className ?? ""}`}>
          {left?.label}
          <span className="swipe-icon">{left?.icon}</span>
        </span>
      </div>
      <div
        ref={row}
        data-own-swipe
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative bg-surface will-change-transform"
        style={{ touchAction: "pan-y" }}
      >
        {children}
      </div>
    </div>
  );
}
