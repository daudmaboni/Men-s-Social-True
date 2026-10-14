"use client";

// The tab bar, made of "Liquid Glass".
// - A single piece of glass moves between tabs on a spring: it stretches in the direction it travels
//   (front edge reaching ahead, back edge trailing), overshoots a little, then settles round.
// - It follows the sliding strip of tabs, so during a swipe it moves exactly with the finger.
// - Inside the glass, the icons are magnified and coloured, like a lens: the active tab lights up
//   exactly where the glass is, even mid-move.
// - Press the bar and the glass lifts; drag along the bar to scrub between tabs.
// Everything moves by writing styles directly each frame, so React doesn't re-render while animating.

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, Sparkles, UserRound } from "lucide-react";
import { isTabRoot, stripPosition, TAB_PATHS, tabFor } from "@/lib/tabs";
import { isSettled, shapeFor, stepSpring, type SpringState } from "@/lib/liquid";
import { useT } from "@/lib/i18n";

const tabs = [
  { href: TAB_PATHS[0], label: "Social", Icon: MessageCircle },
  { href: TAB_PATHS[1], label: "Man", Icon: Sparkles },
  { href: TAB_PATHS[2], label: "Me", Icon: UserRound },
];
const PAD = 6; // space between the bar's edge and the glass

function TabFace({ Icon, label, active }: { Icon: (typeof tabs)[number]["Icon"]; label: string; active: boolean }) {
  return (
    <span className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold">
      <Icon size={21} strokeWidth={active ? 2.4 : 1.8} />
      {label}
    </span>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const active = tabFor(pathname);
  const onRoot = isTabRoot(pathname);
  const t = useT();

  const bar = useRef<HTMLDivElement>(null);
  const glass = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLDivElement>(null);
  const shine = useRef<HTMLDivElement>(null);

  // Animation state lives in refs (not React state) so it never causes re-renders
  const spring = useRef<SpringState>({ x: Math.max(active, 0), v: 0 });
  const lift = useRef({ x: 1, v: 0, target: 1 });
  const target = useRef(Math.max(active, 0));
  const raf = useRef(0);
  const last = useRef(0);
  const reduce = useRef(false);
  const scrub = useRef<{ startX: number; moved: boolean; pointerId: number } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = () => {
      const b = bar.current;
      const g = glass.current;
      if (!b || !g) return;
      const cell = (b.clientWidth - PAD * 2) / tabs.length;
      const s = spring.current;
      const shape = reduce.current ? shapeFor(0) : shapeFor(s.v);
      const l = lift.current.x;
      const left = PAD + s.x * cell;

      // The glass: position, stretch (from its speed) and lift (from pressing)
      g.style.width = `${cell}px`;
      g.style.transformOrigin = shape.origin === "center" ? "50% 50%" : `${shape.origin} 50%`;
      g.style.transform = `translate3d(${left}px,0,0) scale(${shape.scaleX * l}, ${shape.scaleY * l})`;
      // Uneven corners: the front edge is a little rounder and flatter, the back edge pulled out
      const f = Math.abs(shape.lean);
      const front = 26 + 6 * f;
      const back = 26 - 6 * f;
      g.style.borderRadius =
        shape.lean >= 0
          ? `${back}px ${front}px ${front}px ${back}px / ${26 + 2 * f}px ${26 - 3 * f}px ${26 - 3 * f}px ${26 + 2 * f}px`
          : `${front}px ${back}px ${back}px ${front}px / ${26 - 3 * f}px ${26 + 2 * f}px ${26 + 2 * f}px ${26 - 3 * f}px`;

      // The lens: the same icons, magnified and coloured, lined up with the real ones underneath
      if (lens.current) {
        // Lined up with the bar, then magnified around the glass centre (undoing the glass stretch,
        // so the icons inside look slightly enlarged rather than squashed)
        const c = left + cell / 2;
        const mx = 1.12 / (shape.scaleX * l);
        const my = 1.12 / (shape.scaleY * l);
        lens.current.style.width = `${b.clientWidth}px`;
        lens.current.style.transformOrigin = "0 0";
        lens.current.style.transform = `translate3d(${-left}px,0,0) translate(${c}px,50%) scale(${mx},${my}) translate(${-c}px,-50%)`;
      }
      // The shine slides across the glass against the direction of travel
      if (shine.current) shine.current.style.transform = `translateX(${-shape.lean * 18}%)`;
    };

    const tick = (now: number) => {
      const dt = last.current ? (now - last.current) / 1000 : 1 / 60;
      last.current = now;
      if (reduce.current) {
        spring.current = { x: target.current, v: 0 };
      } else {
        spring.current = stepSpring(spring.current, target.current, dt);
        const L = lift.current; // a softer spring for the press "lift"
        const a = 520 * (L.target - L.x) - 30 * L.v;
        L.v += a * Math.min(dt, 0.05);
        L.x += L.v * Math.min(dt, 0.05);
      }
      draw();
      const resting = isSettled(spring.current, target.current) && Math.abs(lift.current.target - lift.current.x) < 0.001 && Math.abs(lift.current.v) < 0.01;
      if (resting) {
        spring.current = { x: target.current, v: 0 };
        lift.current.x = lift.current.target;
        draw();
        raf.current = 0;
        last.current = 0;
      } else {
        raf.current = requestAnimationFrame(tick);
      }
    };
    const wake = () => {
      if (!raf.current) raf.current = requestAnimationFrame(tick);
    };

    // While a finger swipes the pages, the glass follows the strip exactly.
    // (Taps and scrubbing set the glass's destination directly, so it always moves on its own spring.)
    const off = stripPosition.subscribe((pos, byFinger) => {
      if (!byFinger || scrub.current?.moved) return;
      target.current = pos;
      wake();
    });
    draw(); // first paint: the glass already sits on the current tab (no glide on page load)

    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    (bar.current as HTMLDivElement & { __wake?: () => void }).__wake = wake;
    return () => {
      off();
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, []);

  // The tab changed (tap, end of a swipe, Back, or an article opened): the glass heads there
  useEffect(() => {
    if (active < 0 || scrub.current?.moved) return;
    target.current = active;
    (bar.current as (HTMLDivElement & { __wake?: () => void }) | null)?.__wake?.();
  }, [active]);

  const wakeBar = () => (bar.current as (HTMLDivElement & { __wake?: () => void }) | null)?.__wake?.();
  const setLift = (on: boolean) => {
    lift.current.target = on ? 1.07 : 1;
    wakeBar();
  };

  // Drag along the bar to scrub through the tabs (the page follows), let go to land on the nearest one
  const strip = () => document.querySelector<HTMLDivElement>(".tab-strip");
  const posFromPointer = (clientX: number) => {
    const b = bar.current!.getBoundingClientRect();
    const cell = (b.width - PAD * 2) / tabs.length;
    return Math.min(Math.max((clientX - b.left - PAD - cell / 2) / cell, 0), tabs.length - 1);
  };
  const onPointerDown = (e: React.PointerEvent) => {
    setLift(true);
    if (onRoot) scrub.current = { startX: e.clientX, moved: false, pointerId: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const sc = scrub.current;
    const st = strip();
    if (!sc || !st) return;
    if (!sc.moved && Math.abs(e.clientX - sc.startX) < 8) return;
    if (!sc.moved) {
      sc.moved = true;
      bar.current?.setPointerCapture(sc.pointerId);
      st.style.scrollSnapType = "none";
    }
    const pos = posFromPointer(e.clientX);
    st.scrollLeft = pos * st.clientWidth;
    target.current = pos; // the glass sits under the finger
    wakeBar();
  };
  const endPress = (e: React.PointerEvent) => {
    setLift(false);
    const sc = scrub.current;
    scrub.current = null;
    if (!sc?.moved) return;
    const st = strip();
    if (!st) return;
    suppressClick.current = true; // the drag shouldn't also count as a tap on a tab
    const landed = Math.round(posFromPointer(e.clientX));
    target.current = landed;
    wakeBar();
    st.style.scrollSnapType = "";
    st.scrollTo({ left: landed * st.clientWidth, behavior: "smooth" });
    if (TAB_PATHS[landed] !== pathname) router.replace(TAB_PATHS[landed], { scroll: false });
  };

  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div
        ref={bar}
        className="glass-bar relative mx-auto max-w-sm touch-none select-none rounded-[32px]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPress}
        onPointerCancel={endPress}
        onPointerLeave={(e) => scrub.current?.moved || endPress(e)}
      >
        {/* The tabs (the real, clickable links) */}
        <ul className="relative grid grid-cols-3 p-1.5">
          {tabs.map(({ href, label, Icon }, i) => {
            const on = i === active;
            return (
              <li key={href}>
                <Link
                  href={href}
                  replace={onRoot}
                  scroll={false}
                  draggable={false}
                  aria-current={on ? "page" : undefined}
                  onClick={(e) => {
                    if (!suppressClick.current && !on) {
                      target.current = i; // start the glass moving right away
                      wakeBar();
                    }
                    if (suppressClick.current) {
                      suppressClick.current = false;
                      e.preventDefault();
                      return;
                    }
                    // Tapping the tab you're already on scrolls it back to the top
                    if (on && onRoot) {
                      e.preventDefault();
                      document.getElementById(`tab-panel-${i}`)?.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  className="block rounded-[24px] text-ink-soft"
                >
                  <TabFace Icon={Icon} label={t(label)} active={false} />
                </Link>
              </li>
            );
          })}
        </ul>

        {/* The moving piece of glass, with a magnified, coloured copy of the icons inside (the lens) */}
        {active >= 0 && (
          <div ref={glass} aria-hidden className="liquid-glass pointer-events-none absolute left-0 top-1.5 bottom-1.5 overflow-hidden">
            <div ref={lens} className="absolute inset-y-0 left-0 will-change-transform">
              <div className="grid h-full grid-cols-3 px-1.5 text-forest-deep">
                {tabs.map(({ href, label, Icon }) => (
                  <TabFace key={href} Icon={Icon} label={t(label)} active />
                ))}
              </div>
            </div>
            <div ref={shine} className="liquid-shine absolute inset-0" />
          </div>
        )}
      </div>
    </nav>
  );
}
