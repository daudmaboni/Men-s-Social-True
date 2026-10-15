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
import { translate } from "@/lib/i18n/translate";
import { currentLang } from "@/lib/me/lang";

const PANELS = [SocialTab, ManTab, MeTab];

/** Tells the Liquid Glass tab bar where the strip is (0 = Social … 2 = Me). */
const setBubble = (position: number, byFinger = false) => {
  stripPosition.set(Math.min(Math.max(position, 0), TAB_PATHS.length - 1), byFinger);
};

const ENTER_CLASSES = ["tab-fade-through", "tab-slide-right", "tab-slide-left"];

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
  jump();
  if (kind === "slide") playIn(tab, forward ? "tab-slide-right" : "tab-slide-left");
  else playIn(tab, "tab-fade-through");
}

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
            <div className="mx-auto max-w-md px-5 pb-32 pt-6 lg:max-w-6xl lg:px-10 lg:pb-14 lg:pt-8">
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
        {panels}
      </div>

      {!onRoot && (
        <div className="overlay-page" id="overlay-page">
          <div className="mx-auto max-w-md px-5 pb-32 pt-6 lg:max-w-3xl lg:px-10 lg:pb-14 lg:pt-8">{children}</div>
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
        <p className="font-semibold">{translate(currentLang(), "Something went wrong here")}</p>
        <button onClick={() => location.reload()} className="mt-4 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white">
          {translate(currentLang(), "Reload")}
        </button>
      </div>
    );
  }
}
