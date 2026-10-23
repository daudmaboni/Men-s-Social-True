"use client";

// Kito's floating button (Step 67): bottom right on every page of the app, like the chat helpers on other
// apps and websites. Tapping it opens Kito in a window: full screen on a phone, a panel in the corner on
// a computer. It sits above the bottom bar, and moves up when the lesson mini player is showing.
// Step 73: on a phone it no longer sits on top of the cards while he reads. It shows near the top of a
// page and when he scrolls back up; while he scrolls down it slides away to the side. Anything can open
// Kito with openKito() (e.g. the "Ask Kito" row on Discover).
// Step 77: on a phone the window can be pulled down to close, like a bottom sheet (the chat scrolls first).

import { useCallback, useEffect, useRef, useState } from "react";
import { animateSpring, type SpringHandle } from "@/lib/motion/spring";
import { pullCloses, useSheetDrag } from "@/lib/motion/useSheetDrag";
import { usePathname } from "next/navigation";
import { useMiniPlayerVisible } from "@/components/course/MiniPlayer";
import { useT } from "@/lib/i18n";
import KitoChat from "./KitoChat";
import KitoMark from "./KitoMark";

const OPEN_EVENT = "kito:open";
/** Opens Kito from anywhere in the app. */
export function openKito() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/**
 * Phones only: true while Kito should step aside.
 * - while he scrolls down through a page (back when he scrolls up a bit, or near the top)
 * - while the "Ask Kito…" row on Discover is on screen (Kito is right there already)
 * Step 84: the tabs scroll inside their own panels, not the window, so we listen to every scroll
 * (capture) and read the position of whatever scrolled. Before, Kito never noticed and sat on the cards.
 */
function useTucked(pathname: string) {
  const [scrolling, setScrolling] = useState(false);
  const [rowShown, setRowShown] = useState(false);
  useEffect(() => {
    setScrolling(false);
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    let target: EventTarget | null = null;
    let anchor = 0;
    const posOf = (t: EventTarget | null) => (t instanceof Element ? t.scrollTop : window.scrollY);
    const onScroll = (e: Event) => {
      const t = e.target === document ? window : e.target;
      if (t instanceof Element && t.scrollHeight - t.clientHeight < 200) return; // small inner lists don't count
      const y = posOf(t);
      if (t !== target) {
        target = t; // another page or tab: measure from its top
        anchor = 0;
      }
      if (y < 120) {
        setScrolling(false);
        anchor = y;
      } else if (y > anchor + 24) {
        setScrolling(true);
        anchor = y;
      } else if (y < anchor - 60) {
        setScrolling(false);
        anchor = y;
      } else if (y > anchor) {
        anchor = Math.max(anchor, y - 24);
      }
    };
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, [pathname]);

  // The "Ask Kito…" row: while it's on screen, the floating button isn't needed
  useEffect(() => {
    setRowShown(false);
    if (window.matchMedia("(min-width: 1024px)").matches || typeof IntersectionObserver === "undefined") return;
    const seen = new Map<Element, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target, e.isIntersecting);
      setRowShown([...seen.values()].some(Boolean));
    });
    const watch = () => document.querySelectorAll("[data-kito-row]").forEach((el) => !seen.has(el) && (seen.set(el, false), io.observe(el)));
    watch();
    const again = setInterval(watch, 1500); // Discover may draw the row a moment later
    return () => {
      clearInterval(again);
      io.disconnect();
    };
  }, [pathname]);
  return scrolling || rowShown;
}

export default function KitoLauncher() {
  const t = useT();
  const pathname = usePathname() ?? "";
  const mini = useMiniPlayerVisible();
  const [open, setOpen] = useState(false);
  const tucked = useTucked(pathname);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // Close with Escape, and when he goes to another page
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => setOpen(false), [pathname]);

  // Pull the window down to close it (phones)
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLButtonElement>(null);
  const anim = useRef<SpringHandle | null>(null);
  const pulled = useRef(0);
  const [phone, setPhone] = useState(false);
  useEffect(() => setPhone(window.matchMedia("(max-width: 1023px)").matches), [open]);
  const place = useCallback((y: number) => {
    pulled.current = y;
    const el = panel.current;
    if (el) el.style.transform = y ? `translate3d(0, ${y}px, 0)` : "";
    if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - y / (el?.offsetHeight || 600)));
  }, []);
  useEffect(() => {
    if (open) pulled.current = 0;
    return () => anim.current?.stop();
  }, [open]);
  const onDrag = useCallback(
    (y: number) => {
      anim.current?.stop();
      if (panel.current) panel.current.style.animation = "none"; // the opening slide must not fight the finger
      place(y);
    },
    [place],
  );
  const onRelease = useCallback(
    (y: number, v: number) => {
      const h = panel.current?.offsetHeight || 600;
      if (pullCloses(y, v, h)) {
        anim.current = animateSpring(y, h + 20, place, { damping: 1, response: 0.3, velocity: Math.max(0, v), restDelta: 2, onDone: () => setOpen(false) });
      } else {
        anim.current = animateSpring(y, 0, place, { damping: 1, response: 0.3, velocity: v });
      }
    },
    [place],
  );
  useSheetDrag(panel, { enabled: open && phone, onDrag, onRelease });

  // Not on Kito's own page, the Studio or the sign-in screens
  if (pathname.startsWith("/social/kito") || pathname.startsWith("/studio") || pathname.startsWith("/account")) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("Ask Kito")}
          title={t("Ask Kito")}
          aria-hidden={tucked || undefined}
          tabIndex={tucked ? -1 : undefined}
          className={`kito-fab fixed right-3 z-30 flex items-center gap-2 rounded-full bg-surface p-0.5 shadow-xl ring-2 ring-forest transition-[bottom,transform,opacity] duration-300 active:scale-95 lg:right-6 lg:p-1 lg:pr-4 ${
            tucked ? "pointer-events-none translate-x-[calc(100%+1rem)] opacity-0" : ""
          } ${
            mini
              ? "bottom-[calc(max(12px,env(safe-area-inset-bottom))+160px)] lg:bottom-[7.5rem]"
              : "bottom-[calc(max(12px,env(safe-area-inset-bottom))+88px)] lg:bottom-6"
          }`}
        >
          <KitoMark size={40} className="kito-wave ring-0 lg:hidden" />
          <KitoMark size={58} className="kito-wave hidden ring-0 lg:block" />
          <span className="hidden text-sm font-bold text-forest-deep lg:inline">{t("Ask Kito")}</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 lg:inset-auto lg:bottom-6 lg:right-6" role="dialog" aria-modal="true" aria-label="Kito">
          {/* Phone: dim the app behind; computer: just the panel */}
          <button ref={scrim} className="absolute inset-0 bg-black/40 lg:hidden" aria-label={t("Close")} onClick={() => setOpen(false)} />
          <div ref={panel} className="kito-panel absolute inset-x-0 bottom-0 top-[max(1rem,env(safe-area-inset-top))] overflow-hidden rounded-t-[28px] bg-surface shadow-2xl ring-1 ring-line lg:static lg:h-[min(640px,calc(100dvh-3rem))] lg:w-[400px] lg:rounded-[28px]">
            <KitoChat onClose={() => setOpen(false)} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
