"use client";

// Pull down to refresh (Step 77), for Discover and Community.
// - Only when the page is already at the very top; then a downward pull moves the content down with
//   resistance (it stretches, it doesn't slide freely), and a ring under the header fills as he pulls.
// - Past the line the ring is full, the arrow turns and the phone ticks, so he knows letting go will refresh.
// - Let go there: the content rests a little lower with the ring spinning until the new content is in,
//   then springs back up. Let go earlier: it just springs back.
// Phones only (touch); "reduce motion" keeps the refresh but skips the movement.

import { useEffect, useRef, useState } from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import { animateSpring, rubberband, type SpringHandle } from "@/lib/motion/spring";
import { haptic } from "@/lib/motion/haptics";
import { useT } from "@/lib/i18n";

const LINE = 72; // px of (stretched) pull that triggers a refresh
const REST = 52; // where the content waits while it refreshes

export default function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<unknown>; children: React.ReactNode }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const pos = useRef(0);
  const anim = useRef<SpringHandle | null>(null);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const busyRef = useRef(false);
  const doRefresh = useRef(onRefresh);
  doRefresh.current = onRefresh;

  const place = (y: number) => {
    pos.current = y;
    if (content.current) content.current.style.transform = y > 0.5 ? `translate3d(0, ${y}px, 0)` : "";
    const r = ring.current;
    if (r) {
      const f = Math.min(1, y / LINE);
      r.style.opacity = String(Math.min(1, y / 24));
      r.style.transform = `translate3d(-50%, ${Math.min(y, LINE) / 2 - 20}px, 0) scale(${0.6 + 0.4 * f})`;
      r.style.setProperty("--pull", String(f));
    }
  };
  const springTo = (to: number, velocity = 0, done?: () => void) => {
    anim.current?.stop();
    anim.current = animateSpring(pos.current, to, place, { damping: 1, response: 0.32, velocity, onDone: done });
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const scroller = el.closest<HTMLElement>(".tab-panel, .overlay-page");
    let g: { y0: number; x0: number; on: boolean; off: boolean; armed: boolean; last: { t: number; y: number } } | null = null;
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1 || busyRef.current) return void (g = null);
      const top = scroller ? scroller.scrollTop : window.scrollY;
      if (top > 0) return void (g = null);
      const p = e.touches[0];
      g = { y0: p.clientY, x0: p.clientX, on: false, off: false, armed: false, last: { t: performance.now(), y: 0 } };
    };
    const move = (e: TouchEvent) => {
      if (!g || g.off) return;
      const p = e.touches[0];
      const dy = p.clientY - g.y0;
      const dx = p.clientX - g.x0;
      if (!g.on) {
        if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
        if (dy > 0 && dy > Math.abs(dx) * 1.3) {
          g.on = true;
          g.y0 = p.clientY;
          anim.current?.stop();
        } else return void (g.off = true);
      }
      if (e.cancelable) e.preventDefault();
      // It stretches: the further he pulls, the less it follows
      const y = rubberband(Math.max(0, p.clientY - g.y0), window.innerHeight, 0.5);
      place(y);
      const now = y >= LINE;
      if (now !== g.armed) {
        g.armed = now;
        setArmed(now);
        if (now) haptic("tick");
      }
      g.last = { t: performance.now(), y };
    };
    const end = () => {
      if (!g?.on) return void (g = null);
      const go = g.armed;
      g = null;
      setArmed(false);
      if (!go) return springTo(0);
      busyRef.current = true;
      setBusy(true);
      springTo(REST);
      const started = performance.now();
      Promise.resolve()
        .then(() => doRefresh.current())
        .catch(() => {})
        .then(() => new Promise((r) => setTimeout(r, Math.max(0, 600 - (performance.now() - started)))))
        .then(() => {
          haptic("done");
          busyRef.current = false;
          setBusy(false);
          springTo(0);
        });
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
      anim.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={box} className="relative">
      <div
        ref={ring}
        className="pull-ring pointer-events-none absolute left-1/2 top-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-forest shadow-md ring-1 ring-line"
        style={{ opacity: 0 }}
        role="status"
        aria-live="polite"
        aria-label={busy ? t("Refreshing…") : undefined}
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowDown size={18} className={`transition-transform duration-200 ${armed ? "rotate-180" : ""}`} />}
      </div>
      <div ref={content}>{children}</div>
    </div>
  );
}
