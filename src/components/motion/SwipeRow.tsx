"use client";

// A horizontal list he swipes through, one card at a time (only a thin edge of the next card shows).
// While he hasn't swiped yet — or hasn't swiped for 30 seconds — the row teaches the gesture:
// - the current card slides a little to the left and back by itself, every few seconds
// - a frosted-glass "Swipe" pill with a moving hand sits on the card (it doesn't block taps)
// - "Swipe to see more" shows under the row
// As soon as he swipes, all of it stops; it comes back after 30 seconds without a swipe.
// Dots show where he is; on a computer, arrow buttons do the same. Respects "reduce motion".

import { Children, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Hand } from "lucide-react";
import { useT } from "@/lib/i18n";

const IDLE_MS = 30_000;

export default function SwipeRow({
  children,
  hint,
  slideClass = "w-[calc(100%-0.5rem)] lg:w-[calc((100%-2rem)/3)]",
  label,
  focus,
}: {
  /** Kept for older callers; the hint no longer depends on it. */
  id?: string;
  children: React.ReactNode;
  /** Hint text, e.g. "Swipe to see more". */
  hint: string;
  slideClass?: string;
  label?: string;
  /** Show this card (e.g. his current lesson): jumps there at first, glides there when it changes. */
  focus?: number;
}) {
  const t = useT();
  const scroller = useRef<HTMLDivElement>(null);
  const slides = Children.toArray(children);
  const many = slides.length > 1;
  const [index, setIndex] = useState(0);
  const [teach, setTeach] = useState(many);
  const [atEnd, setAtEnd] = useState(false);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hide the lesson when he swipes; bring it back after 30 seconds without a swipe
  const swiped = useCallback(() => {
    setTeach(false);
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => setTeach(true), IDLE_MS);
  }, []);
  useEffect(() => () => void (idle.current && clearTimeout(idle.current)), []);

  const last = useRef(0);
  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    const start = kids[0]?.offsetLeft ?? 0;
    let best = 0;
    kids.forEach((k, i) => {
      if (Math.abs(k.offsetLeft - start - el.scrollLeft) < Math.abs(kids[best].offsetLeft - start - el.scrollLeft)) best = i;
    });
    setIndex(best);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    if (Math.abs(el.scrollLeft - last.current) > 24) {
      last.current = el.scrollLeft;
      swiped();
    }
  }, [swiped]);

  // Bring the focused card into view (no animation the first time)
  const focused = useRef<number | null>(null);
  useEffect(() => {
    const el = scroller.current;
    if (focus === undefined || focus < 0 || !el) return;
    const kid = el.children[focus] as HTMLElement | undefined;
    if (!kid) return;
    const first = focused.current === null;
    if (focused.current === focus) return;
    focused.current = focus;
    last.current = kid.offsetLeft - (el.children[0] as HTMLElement).offsetLeft;
    el.scrollTo({ left: last.current, behavior: first ? "instant" : "smooth" });
    setIndex(focus);
  }, [focus, slides.length]);

  const go = (i: number) => {
    const el = scroller.current;
    const kid = el?.children[i] as HTMLElement | undefined;
    if (!el || !kid) return;
    el.scrollTo({ left: kid.offsetLeft - (el.children[0] as HTMLElement).offsetLeft, behavior: "smooth" });
  };

  // On the last card, the lesson points the other way
  const back = atEnd && index > 0;

  return (
    <div className="relative" role="region" aria-roledescription="carousel" aria-label={label}>
      {/* py-2/-my-2 leave room for the cards' borders and shadows, so they aren't cut at the top or bottom */}
      <div
        ref={scroller}
        onScroll={onScroll}
        className="no-scrollbar -mx-5 -my-2 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto overscroll-x-contain px-5 py-2 lg:mx-0 lg:scroll-px-0 lg:px-0"
      >
        {slides.map((s, i) => (
          <div
            key={i}
            className={`relative shrink-0 snap-start ${slideClass} ${teach && i === index ? (back ? "swipe-tease-back" : "swipe-tease") : ""}`}
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${slides.length}`}
          >
            {s}
            {teach && i === index && many && (
              <span className="glass-swipe pointer-events-none absolute right-4 top-4 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold" aria-hidden>
                <Hand size={14} className={back ? "swipe-hand-back" : "swipe-hand"} />
                {t("Swipe")}
              </span>
            )}
          </div>
        ))}
      </div>

      {many && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className={`flex items-center gap-1.5 text-xs font-semibold text-forest transition-opacity duration-500 ${teach ? "opacity-100" : "opacity-0"}`} aria-live="polite">
            <Hand size={15} className="swipe-hand" aria-hidden />
            {hint}
          </p>
          <div className="flex items-center gap-2">
            {/* Long rows (a course's lessons): "3 / 37" instead of a dot for each */}
            {slides.length > 8 ? (
              <span className="rounded-full bg-bg px-2.5 py-1 text-[0.6875rem] font-bold tabular-nums text-ink-soft ring-1 ring-line">
                {index + 1} / {slides.length}
              </span>
            ) : (
            <div className="flex items-center gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  aria-label={t("Go to {n}", { n: i + 1 })}
                  aria-current={i === index}
                  className={`h-2 rounded-full transition-all ${i === index ? "w-5 bg-forest" : "w-2 bg-line"}`}
                />
              ))}
            </div>
            )}
            {/* Arrows for mouse users on a computer */}
            <button
              onClick={() => go(Math.max(0, index - 1))}
              disabled={index === 0}
              aria-label={t("Previous")}
              className="hidden h-8 w-8 items-center justify-center rounded-full bg-surface ring-1 ring-line disabled:opacity-40 lg:flex"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => go(Math.min(slides.length - 1, index + 1))}
              disabled={atEnd}
              aria-label={t("Next")}
              className="hidden h-8 w-8 items-center justify-center rounded-full bg-surface ring-1 ring-line disabled:opacity-40 lg:flex"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
