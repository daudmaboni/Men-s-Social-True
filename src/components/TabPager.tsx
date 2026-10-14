"use client";

// The three main tabs side by side in one sliding strip, like a phone app.
// - Swiping uses the phone's own scrolling (momentum + snap), so the page moves exactly with the finger
//   and the next tab slides in beside it.
// - All three tabs stay open in the background: no reloads, and each keeps its scroll position.
// - The address (/social, /man, /me) follows the tab you land on.
// - Other pages (an article, sign-up…) open on top of the strip and slide in from the right.

import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import SocialTab from "@/components/tabs/SocialTab";
import ManTab from "@/components/tabs/ManTab";
import MeTab from "@/components/tabs/MeTab";
import { isTabRoot, stripPosition, TAB_PATHS, tabFor } from "@/lib/tabs";
import LockedTab from "@/components/account/LockedTab";
import { readTabTransition } from "@/lib/tabTransition";
import { useAccount } from "@/lib/account/useAccount";

const PANELS = [SocialTab, ManTab, MeTab];

/** Tells the Liquid Glass tab bar where the strip is (0 = Social … 2 = Me). */
const setBubble = (position: number, byFinger = false) => {
  stripPosition.set(Math.min(Math.max(position, 0), TAB_PATHS.length - 1), byFinger);
  frostPanels(position);
};

/**
 * Frosted-glass feel while the pages slide, made cheap enough for any phone:
 * a frosted veil fades in over the page that's leaving / arriving, and the page shrinks and fades a little.
 * Only opacity and transform change (the phone's graphics chip does that for free) — no live blur,
 * which made phones redraw the whole screen every frame and feel sticky.
 * It follows the strip, so it tracks the finger exactly and works for taps too.
 */
const ENTER_CLASSES = ["glass-from-right", "glass-from-left", "tab-fade-through", "tab-slide-right", "tab-slide-left"];

/** Play an entrance animation on a tab's content (restarts cleanly on quick repeated taps). */
function playIn(tab: number, cls: string) {
  const content = document.getElementById(`tab-panel-${tab}`)?.firstElementChild as HTMLElement | null;
  if (!content) return;
  content.classList.remove(...ENTER_CLASSES);
  void content.offsetWidth; // restart the animation
  content.classList.add(cls);
  content.addEventListener("animationend", () => content.classList.remove(cls), { once: true });
}

/** Move the strip to the tapped tab using the chosen transition. */
function switchTab(el: HTMLElement, left: number, tab: number, from: number) {
  const kind = readTabTransition();
  const jump = () => el.scrollTo({ left, behavior: "instant" });
  const forward = tab > from;
  if (reduceMotion() || kind === "instant") return jump();
  if (kind === "reveal") {
    // The new page grows out in a circle from the tab he tapped in the bar
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
    const button = document.querySelector<HTMLElement>(`nav[aria-label="Main"] a[href="${TAB_PATHS[tab]}"]`)?.getBoundingClientRect();
    if (!doc.startViewTransition || !button) return jump();
    const x = button.left + button.width / 2;
    const y = button.top + button.height / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    doc
      .startViewTransition(jump)
      .ready.then(() =>
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
          { duration: 480, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
        ),
      )
      .catch(() => {});
    return;
  }
  jump();
  if (kind === "fade") playIn(tab, "tab-fade-through");
  else if (kind === "slide") playIn(tab, forward ? "tab-slide-right" : "tab-slide-left");
  else playIn(tab, forward ? "glass-from-right" : "glass-from-left");
}

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function frostPanels(position: number) {
  // The frosted veil while swiping belongs to the "Frosted" choice; the others keep a plain slide
  if (reduceMotion() || readTabTransition() !== "frosted") {
    for (let i = 0; i < TAB_PATHS.length; i++) {
      const veil = document.getElementById(`tab-veil-${i}`);
      const content = document.getElementById(`tab-panel-${i}`)?.firstElementChild as HTMLElement | null;
      if (veil) veil.style.opacity = "0";
      if (content) {
        content.style.transform = "";
        content.style.opacity = "";
        content.style.willChange = "";
      }
    }
    return;
  }
  for (let i = 0; i < TAB_PATHS.length; i++) {
    const content = document.getElementById(`tab-panel-${i}`)?.firstElementChild as HTMLElement | null;
    const veil = document.getElementById(`tab-veil-${i}`);
    if (!content || !veil) continue;
    const d = Math.min(Math.abs(position - i), 1); // 0 = in the centre, 1 = a full page away
    if (d < 0.004 || d > 0.996) {
      // In focus, or fully off screen: nothing to draw
      content.style.transform = "";
      content.style.opacity = "";
      content.style.willChange = "";
      veil.style.opacity = "0";
      continue;
    }
    const e = Math.sin((d * Math.PI) / 2); // eases in quickly, like the Discover ⇄ Community glide
    content.style.willChange = "transform, opacity";
    content.style.transform = `scale(${(1 - e * 0.05).toFixed(4)})`;
    content.style.opacity = String(1 - e * 0.35);
    veil.style.opacity = e.toFixed(3);
  }
}

export default function TabPager({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const strip = useRef<HTMLDivElement>(null);
  const onRoot = isTabRoot(pathname);
  const tab = tabFor(pathname);
  const [placed, setPlaced] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef(0);
  // Is a finger moving the pages (or did one just let go and the page is still gliding)?
  const fingerUntil = useRef(0);
  // Man and Me hold his private records: guests see a locked preview instead
  const acc = useAccount();
  const locked = acc.status === "guest";

  // Put the strip on the right tab: instantly on first load, smoothly when a tab is tapped
  useLayoutEffect(() => {
    const el = strip.current;
    if (!el || tab < 0) return;
    const target = tab * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) > 1) {
      if (!placed) {
        el.scrollTo({ left: target, behavior: "instant" });
      } else {
        // A tap on the tab bar: the page changes with the transition he chose on Me → Tab switching
        const from = Math.round(el.scrollLeft / el.clientWidth);
        switchTab(el, target, tab, from);
      }
    }
    if (!placed) {
      setBubble(tab);
      setPlaced(true);
    }
  }, [tab, placed]);

  // Inside an article etc., the bubble rests on that page's tab
  useEffect(() => {
    if (!onRoot && tab >= 0) setBubble(tab);
  }, [onRoot, tab]);

  // Turning the phone or resizing the window: stay on the same tab
  useEffect(() => {
    const onResize = () => {
      const el = strip.current;
      if (el && tab >= 0) el.scrollTo({ left: tab * el.clientWidth, behavior: "instant" });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [tab]);

  const onScroll = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() =>
      setBubble(el.scrollLeft / el.clientWidth, performance.now() < fingerUntil.current),
    );
    // When the strip comes to rest on another tab, update the address (without adding to Back history)
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const landed = Math.round(el.scrollLeft / el.clientWidth);
      if (isTabRoot(window.location.pathname) && TAB_PATHS[landed] !== window.location.pathname) {
        router.replace(TAB_PATHS[landed], { scroll: false });
      }
    }, 90);
  }, [router]);

  // The three tabs are built once and kept: switching tabs (or the address changing) doesn't redraw them,
  // which removed a stutter at the end of every swipe.
  const panels = useMemo(
    () =>
      PANELS.map((Panel, i) => (
          <section
            key={TAB_PATHS[i]}
            id={`tab-panel-${i}`}
            className="tab-panel"
            aria-label={["Social", "Man", "Me"][i]}
          >
            <div className="mx-auto max-w-md px-5 pb-32 pt-6">
              <PanelBoundary>
                {i > 0 && acc.status === "loading" ? (
                  <div className="h-64 animate-pulse rounded-3xl bg-surface ring-1 ring-line" />
                ) : i > 0 && locked ? (
                  <LockedTab tab={i === 1 ? "man" : "me"} />
                ) : (
                  <Panel />
                )}
              </PanelBoundary>
            </div>
          </section>
      )),
    [acc.status, locked],
  );

  return (
    <>
      <div
        ref={strip}
        onScroll={onScroll}
        onTouchStart={() => (fingerUntil.current = Infinity)}
        onTouchEnd={() => (fingerUntil.current = performance.now() + 700)}
        onTouchCancel={() => (fingerUntil.current = performance.now() + 700)}
        className={`tab-strip ${placed ? "opacity-100" : "opacity-0"}`}
        inert={!onRoot}
        aria-hidden={!onRoot}
      >
        {/* Frosted veils, one over each page (faded in only while pages slide) */}
        {TAB_PATHS.map((path, i) => (
          <div key={path} id={`tab-veil-${i}`} aria-hidden className="tab-veil" style={{ left: `${i * 100}%` }} />
        ))}
        {panels}
      </div>

      {!onRoot && (
        <div className="overlay-page" id="overlay-page">
          <div className="mx-auto max-w-md px-5 pb-32 pt-6">{children}</div>
        </div>
      )}
    </>
  );
}

/** If one tab crashes, the other two keep working. */
class PanelBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
        <p className="font-semibold">Something went wrong here</p>
        <button onClick={() => location.reload()} className="mt-4 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white">
          Reload
        </button>
      </div>
    );
  }
}
