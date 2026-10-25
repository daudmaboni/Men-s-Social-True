"use client";

// A switch made of Liquid Glass (used for Discover / Community).
// The same piece of glass as the tab bar: it slides on a spring, stretches in the direction it moves
// (front edge reaching ahead), overshoots a little and settles. The label under the glass is shown
// magnified and coloured, like a lens. Styles are written directly each frame — no React re-renders.

import { useEffect, useRef } from "react";
import { isSettled, shapeFor, stepSpring, type SpringState } from "@/lib/liquid";

const PAD = 4;

export default function LiquidSegment<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const index = Math.max(0, options.findIndex((o) => o.id === value));
  const bar = useRef<HTMLDivElement>(null);
  const glass = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLDivElement>(null);
  const spring = useRef<SpringState>({ x: index, v: 0 });
  const target = useRef(index);
  const raf = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = () => {
      const b = bar.current;
      const g = glass.current;
      if (!b || !g) return;
      const cell = (b.clientWidth - PAD * 2) / options.length;
      const s = spring.current;
      const shape = reduce ? shapeFor(0) : shapeFor(s.v * 1.4);
      const left = PAD + s.x * cell;
      g.style.width = `${cell}px`;
      g.style.transformOrigin = shape.origin === "center" ? "50% 50%" : `${shape.origin} 50%`;
      g.style.transform = `translate3d(${left}px,0,0) scale(${shape.scaleX}, ${shape.scaleY})`;
      if (lens.current) {
        const c = left + cell / 2;
        lens.current.style.width = `${b.clientWidth}px`;
        lens.current.style.transform = `translate3d(${-left}px,0,0) translate(${c}px,50%) scale(${1.06 / shape.scaleX},${1.06 / shape.scaleY}) translate(${-c}px,-50%)`;
      }
    };
    const tick = (now: number) => {
      const dt = last.current ? (now - last.current) / 1000 : 1 / 60;
      last.current = now;
      spring.current = reduce ? { x: target.current, v: 0 } : stepSpring(spring.current, target.current, dt);
      draw();
      if (isSettled(spring.current, target.current)) {
        spring.current = { x: target.current, v: 0 };
        draw();
        raf.current = 0;
        last.current = 0;
      } else raf.current = requestAnimationFrame(tick);
    };
    (bar.current as HTMLDivElement & { __wake?: () => void }).__wake = () => {
      if (!raf.current) raf.current = requestAnimationFrame(tick);
    };
    draw();
    const ro = new ResizeObserver(draw);
    if (bar.current) ro.observe(bar.current);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [options.length]);

  // Value changed (tap, or from the address): glide there
  useEffect(() => {
    target.current = index;
    (bar.current as (HTMLDivElement & { __wake?: () => void }) | null)?.__wake?.();
  }, [index]);

  const faces = (active: boolean) =>
    options.map((o) => (
      <span key={o.id} className={`cap-sm flex items-center justify-center py-2 text-sm font-semibold ${active ? "text-forest-deep" : ""}`}>
        {o.label}
      </span>
    ));

  return (
    <div ref={bar} className="glass-bar relative inline-grid rounded-full" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, padding: PAD }} role="tablist" aria-label={label}>
      {options.map((o, i) => (
        <button
          key={o.id}
          role="tab"
          id={`tab-${o.id}`}
          aria-selected={i === index}
          onClick={() => onChange(o.id)}
          className="relative z-0 rounded-full px-4 text-ink-soft"
        >
          {faces(false)[i]}
        </button>
      ))}
      {/* The moving glass, with a magnified, coloured copy of the labels inside */}
      <div ref={glass} aria-hidden className="liquid-glass pointer-events-none absolute left-0 overflow-hidden rounded-full" style={{ top: PAD, bottom: PAD }}>
        <div ref={lens} className="absolute inset-y-0 left-0 grid will-change-transform" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, paddingLeft: PAD, paddingRight: PAD, transformOrigin: "0 0" }}>
          {options.map((o) => (
            <span key={o.id} className="cap-sm flex items-center justify-center px-4 text-sm font-semibold text-forest-deep">
              {o.label}
            </span>
          ))}
        </div>
        <div className="liquid-shine absolute inset-0" />
      </div>
    </div>
  );
}
