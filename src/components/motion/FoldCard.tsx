"use client";

// A card that stays short until he taps it (Step 51): the header, a one-line description and a small
// peek of today's number. Tapping unfolds the rest (like paper opening downwards); scrolling it off
// the screen folds it again, without the page jumping under his finger.
// Other parts of the app can open one by its id: openFold("water").

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n";

const EVENT = "ms-open-fold";

/** Open the fold card with this id (and bring it into view). */
export function openFold(id: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

/**
 * Fold `close()` once the element has been on screen and then leaves it (scrolled away, or another tab).
 * When it leaves above the screen, the scroll position is corrected so what he's looking at stays still.
 */
export function useFoldOnLeave(ref: React.RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const el = ref.current;
    if (!open || !el || typeof IntersectionObserver === "undefined") return;
    let seen = false;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        seen = true;
        return;
      }
      if (!seen) return;
      const above = e.boundingClientRect.bottom <= (e.rootBounds?.top ?? 0) + 1;
      const before = el.offsetHeight;
      flushSync(() => closeRef.current());
      const shrink = before - el.offsetHeight;
      if (above && shrink > 0) {
        const scroller = el.closest<HTMLElement>(".tab-panel, .overlay-page");
        if (scroller) scroller.scrollTop -= shrink;
        else window.scrollBy({ top: -shrink, behavior: "instant" });
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, open]);
}

export default function FoldCard({
  id,
  head,
  description,
  peek,
  children,
  className = "",
}: {
  /** Used for openFold(id) and as the element id (links like #water). */
  id?: string;
  /** The card's own header (icon, title, badge). Buttons inside it keep working. */
  head: React.ReactNode;
  description: string;
  /** A short line of today's state, shown while folded. */
  peek?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  const box = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  // Folding because he scrolled away happens at once (no animation), so the page doesn't move
  const [instant, setInstant] = useState(false);

  const close = useCallback(() => {
    setInstant(true);
    setOpen(false);
  }, []);
  useFoldOnLeave(box, open, close);

  const toggle = () => {
    setInstant(false);
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!id) return;
    const onOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) return;
      setInstant(false);
      setOpen(true);
      requestAnimationFrame(() => box.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, [id]);

  return (
    <section id={id} ref={box} className={`scroll-mt-4 rounded-3xl bg-surface ring-1 ring-line ${className}`}>
      {/* The whole top part toggles; buttons inside the header (like "Goal") still do their own thing */}
      <div
        className="cursor-pointer p-5 pb-4"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button, a, input") && !(e.target as HTMLElement).closest("[data-fold-toggle]")) return;
          toggle();
        }}
      >
        {head}
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs leading-relaxed text-ink-soft">{description}</p>
            {peek && !open && <div className="mt-1.5 text-sm font-semibold">{peek}</div>}
          </div>
          <button
            type="button"
            data-fold-toggle
            aria-expanded={open}
            aria-controls={id ? `${id}-body` : undefined}
            aria-label={t(open ? "Show less" : "Show more")}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint text-forest transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          >
            <ChevronDown size={18} aria-hidden />
          </button>
        </div>
      </div>
      <div id={id ? `${id}-body` : undefined} className="expand" data-open={open} data-instant={instant} inert={!open}>
        <div>
          <div className="fold-body px-5 pb-5">{children}</div>
        </div>
      </div>
    </section>
  );
}
