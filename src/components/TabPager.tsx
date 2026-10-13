"use client";

// The three main tabs side by side in one sliding strip, like a phone app.
// - Swiping uses the phone's own scrolling (momentum + snap), so the page moves exactly with the finger
//   and the next tab slides in beside it.
// - All three tabs stay open in the background: no reloads, and each keeps its scroll position.
// - The address (/social, /man, /me) follows the tab you land on.
// - Other pages (an article, sign-up…) open on top of the strip and slide in from the right.

import { Component, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import SocialTab from "@/components/tabs/SocialTab";
import ManTab from "@/components/tabs/ManTab";
import MeTab from "@/components/tabs/MeTab";
import { bubbleShape, isTabRoot, TAB_PATHS, tabFor } from "@/lib/tabs";

const PANELS = [SocialTab, ManTab, MeTab];

/** Tells the glass bubble in the tab bar where the strip is (0 = Social … 2 = Me). */
function setBubble(position: number) {
  const { x, stretch } = bubbleShape(position);
  const root = document.documentElement.style;
  root.setProperty("--tab-pos", String(x));
  root.setProperty("--tab-stretch", String(stretch));
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

  // Put the strip on the right tab: instantly on first load, smoothly when a tab is tapped
  useLayoutEffect(() => {
    const el = strip.current;
    if (!el || tab < 0) return;
    const target = tab * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) > 1) {
      el.scrollTo({ left: target, behavior: placed ? "smooth" : "instant" });
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
    frame.current = requestAnimationFrame(() => setBubble(el.scrollLeft / el.clientWidth));
    // When the strip comes to rest on another tab, update the address (without adding to Back history)
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const landed = Math.round(el.scrollLeft / el.clientWidth);
      if (isTabRoot(window.location.pathname) && TAB_PATHS[landed] !== window.location.pathname) {
        router.replace(TAB_PATHS[landed], { scroll: false });
      }
    }, 90);
  }, [router]);

  return (
    <>
      <div
        ref={strip}
        onScroll={onScroll}
        className={`tab-strip ${placed ? "opacity-100" : "opacity-0"}`}
        inert={!onRoot}
        aria-hidden={!onRoot}
      >
        {PANELS.map((Panel, i) => (
          <section
            key={TAB_PATHS[i]}
            id={`tab-panel-${i}`}
            className="tab-panel"
            aria-label={["Social", "Man", "Me"][i]}
            aria-hidden={onRoot && i !== tab ? true : undefined}
          >
            <div className="mx-auto max-w-md px-5 pb-32 pt-6">
              <PanelBoundary>
                <Panel />
              </PanelBoundary>
            </div>
          </section>
        ))}
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
