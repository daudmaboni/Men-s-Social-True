"use client";

import { useEffect, useRef, useState } from "react";


/**
 * A real-size phone screen (390 × 844), shrunk as a whole so it always fits on the admin's screen.
 * Inside it works like the app: scroll, swipe the cards, open the topics. Links open in a new tab,
 * so the Studio page itself never navigates away.
 */
const PHONE_W = 390;
const PHONE_H = 844;
const BEZEL = 12;

export default function PhonePreview({ children, reserve = 140 }: { children: React.ReactNode; /** Screen height kept free for the controls above (px). */ reserve?: number }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);

  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      const h = window.innerHeight - reserve; // leave room for the Studio bar and the controls above
      setScale(Math.min(1, w / (PHONE_W + BEZEL * 2), Math.max(0.4, h / (PHONE_H + BEZEL * 2))));
    };
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [reserve]);

  // Links inside the preview open in a new tab instead of leaving the Studio
  const onClickCapture = (e: React.MouseEvent) => {
    const a = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    window.open(a.href, "_blank", "noopener");
  };

  return (
    <div ref={outer} className="w-full">
      <div
        className="mx-auto overflow-hidden rounded-[44px] bg-ink/85 shadow-xl"
        style={{ width: PHONE_W + BEZEL * 2, height: PHONE_H + BEZEL * 2, padding: BEZEL, zoom: scale }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[34px] bg-bg">
          {/* Notch */}
          <div className="pointer-events-none absolute left-1/2 top-2 z-10 h-6 w-28 -translate-x-1/2 rounded-full bg-ink/85" aria-hidden />
          <div
            onClickCapture={onClickCapture}
            className="h-full overflow-y-auto overscroll-contain px-5 pb-10 pt-12 [scrollbar-width:none]"
            aria-label="Phone preview of the Discover page"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
