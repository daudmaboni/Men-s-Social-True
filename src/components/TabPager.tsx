"use client";

// Phones: a 4px side margin, so cards run almost to the screen edge (Step 83).
// The three main tabs side by side in one sliding strip, like a phone app.
// - Swiping: the page follows the finger exactly; when he lets go, a spring (not the browser's slow snap)
//   carries it on at his finger's speed to the next tab. A quick flick is enough; a slow short drag springs back.
//   A finger touching the page mid-glide catches it where it is (Step 76).
// - Tapping Social / Man / Me uses the very same glide, so both feel identical (src/lib/tabGlide.ts).
// - All three tabs stay open in the background: no reloads, and each keeps its scroll position.
// - The address (/social, /man, /me) follows the tab you land on.
// - Other pages (an article, sign-up…) open on top of the strip and slide in from the right.
// - Swiping sideways on such a page works too: it slides away and the next tab comes in (Step 53).
// - Each tab remembers the page it was left on, and opens it again when he comes back (Step 54).

import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import SocialTab from "@/components/tabs/SocialTab";
import ManTab from "@/components/tabs/ManTab";
import MeTab from "@/components/tabs/MeTab";
import { isTabRoot, stripPosition, TAB_PATHS, tabFor, tabMemory } from "@/lib/tabs";
import LockedTab from "@/components/account/LockedTab";
import { cancelGlide, glideTo, holdSnap, isGliding, landingTab, releaseSnap, TAB_SPRING } from "@/lib/tabGlide";
import { animateSpring, rubberband, type SpringHandle } from "@/lib/motion/spring";

/** Fastest hand-off speed we pass to a spring (px/s), so a wild flick can't fling the page. */
const MAX_V = 6000;
const clampV = (v: number) => Math.max(-MAX_V, Math.min(MAX_V, v));
import { useAccount } from "@/lib/account/useAccount";
import { translate } from "@/lib/i18n/translate";
import { currentLang } from "@/lib/me/lang";

const PANELS = [SocialTab, ManTab, MeTab];

/** Tells the Liquid Glass tab bar where the strip is (0 = Social … 2 = Me). */
const setBubble = (position: number, byFinger = false) => {
  stripPosition.set(Math.min(Math.max(position, 0), TAB_PATHS.length - 1), byFinger);
};

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
      } else if (!dragging.current) {
        // A tap on the tab bar (or the sidebar): the same glide as a swipe
        glideTo(el, target);
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

  /** The strip has come to rest: make the address match the tab (without adding to Back history). */
  const settle = useCallback(() => {
    const el = strip.current;
    if (!el || dragging.current || isGliding()) return;
    const landed = Math.round(el.scrollLeft / el.clientWidth);
    if (isTabRoot(window.location.pathname) && TAB_PATHS[landed] !== window.location.pathname) {
      // Swiped back to a tab he had left on a page (the course…): open that page straight away
      const back = tabMemory.take(landed);
      if (back) router.push(back, { scroll: false });
      else router.replace(TAB_PATHS[landed], { scroll: false });
    }
  }, [router]);

  const onScroll = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() =>
      setBubble(el.scrollLeft / el.clientWidth, performance.now() < fingerUntil.current),
    );
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(settle, 90);
  }, [settle]);

  // ---- Swiping with a finger ----
  // The tabs only let the browser scroll up and down (touch-action: pan-y), so a sideways drag comes to us:
  // the strip follows the finger, then glides to where the swipe should land.
  const dragging = useRef(false);
  const drag = useRef<{ id: number; x: number; y: number; left: number; startTab: number; axis: "x" | "y" | null; samples: { t: number; left: number }[] } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = strip.current;
    if (!el || e.pointerType === "mouse" || !e.isPrimary) return;
    // Rows that scroll sideways themselves (card rows, chips) and sliders keep their own swipe
    if ((e.target as Element).closest?.(".overflow-x-auto, input, textarea, select, [data-own-swipe]")) return;
    if (isGliding()) cancelGlide(); // catch the page mid-glide
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      left: el.scrollLeft,
      startTab: Math.round(el.scrollLeft / el.clientWidth),
      axis: null,
      samples: [],
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const el = strip.current;
    const d = drag.current;
    if (!el || !d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.axis === "y") {
        drag.current = null; // he's scrolling the page up or down
        return;
      }
      dragging.current = true;
      fingerUntil.current = Infinity;
      holdSnap(el);
    }
    const max = el.scrollWidth - el.clientWidth;
    let left = d.left - dx;
    // A little resistance past the first and last tab
    if (left < 0) left = left / 4;
    if (left > max) left = max + (left - max) / 4;
    el.scrollLeft = Math.min(Math.max(left, 0), max);
    const now = performance.now();
    d.samples.push({ t: now, left: d.left - dx });
    while (d.samples.length > 2 && now - d.samples[0].t > 100) d.samples.shift();
  };

  const endDrag = (e: React.PointerEvent) => {
    const el = strip.current;
    const d = drag.current;
    if (!el || !d || e.pointerId !== d.id) return;
    drag.current = null;
    if (d.axis !== "x") return;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const velocity = first && last && last.t > first.t ? (last.left - first.left) / (last.t - first.t) : 0;
    // He held still before letting go: no speed to carry on
    const still = !last || performance.now() - last.t > 80;
    const v = still ? 0 : velocity;
    const to = landingTab({ startTab: d.startTab, dragPx: el.scrollLeft - d.left, width: el.clientWidth, velocity: v, count: TAB_PATHS.length });
    dragging.current = false;
    fingerUntil.current = performance.now() + 400;
    // The glide starts at the speed his finger was moving, so there's no seam between drag and glide
    glideTo(el, to * el.clientWidth, settle, clampV(v * 1000));
  };

  // ---- Swiping on a page opened on top (a lesson, an article, the course…) ----
  // The page slides away with the finger and the next tab slides in beside it, like swiping between tabs.
  // Let go far or fast enough and that tab opens; otherwise the page springs back.
  const overlay = useRef<HTMLDivElement>(null);
  const odrag = useRef<{ id: number; x: number; y: number; axis: "x" | "y" | null; dx: number; samples: { t: number; dx: number }[] } | null>(null);
  const leaving = useRef(false);
  const ospring = useRef<SpringHandle | null>(null);

  /** Move the page on top and the strip behind it together: the page `x` px sideways, the tab beside it following. */
  const placeOverlay = useCallback(
    (x: number) => {
      const el = strip.current;
      const ov = overlay.current;
      if (!el || !ov) return;
      const w = el.clientWidth;
      ov.style.transform = `translateX(${x}px)`;
      el.scrollLeft = Math.min(Math.max(tab * w - x, 0), el.scrollWidth - w);
      setBubble(el.scrollLeft / w, true);
    },
    [tab],
  );

  const onOverlayDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || !e.isPrimary || tab < 0 || leaving.current) return;
    if ((e.target as Element).closest?.(".overflow-x-auto, input, textarea, select, video, [data-own-swipe], [role=dialog]")) return;
    // Springing back after a short swipe? His finger catches the page right where it is.
    const moving = ospring.current?.running();
    const at = moving ? ospring.current!.now().value : 0;
    if (moving) {
      ospring.current!.stop();
      ospring.current = null;
    }
    odrag.current = { id: e.pointerId, x: e.clientX - at, y: e.clientY, axis: moving ? "x" : null, dx: at, samples: [] };
  };

  const onOverlayMove = (e: React.PointerEvent) => {
    const el = strip.current;
    const ov = overlay.current;
    const d = odrag.current;
    if (!el || !ov || !d || e.pointerId !== d.id) return;
    let dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      d.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
      if (d.axis === "y") {
        odrag.current = null; // he's scrolling the page
        return;
      }
      ov.style.transition = "none";
      holdSnap(el);
      snapshot(); // the page's picture stays on its tab while the next one slides in
    }
    // No tab on that side (Social has nothing to its left, Me nothing to its right):
    // it still moves, but less and less the further he pulls
    const w = el.clientWidth;
    if ((dx > 0 && tab === 0) || (dx < 0 && tab === TAB_PATHS.length - 1)) dx = rubberband(dx, w);
    d.dx = dx;
    placeOverlay(dx);
    const now = performance.now();
    d.samples.push({ t: now, dx });
    while (d.samples.length > 2 && now - d.samples[0].t > 100) d.samples.shift();
  };

  const endOverlayDrag = (e: React.PointerEvent) => {
    const el = strip.current;
    const ov = overlay.current;
    const d = odrag.current;
    if (!el || !ov || !d || e.pointerId !== d.id) return;
    odrag.current = null;
    if (d.axis !== "x") return;
    const w = el.clientWidth;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const still = !last || performance.now() - last.t > 80;
    // Finger speed in px per ms (page moving right = positive)
    const vx = still || !first || last.t <= first.t ? 0 : (last.dx - first.dx) / (last.t - first.t);
    const to = landingTab({ startTab: tab, dragPx: -d.dx, width: w, velocity: -vx, count: TAB_PATHS.length });
    ov.style.transition = "none";
    cancelGlide();
    const target = to === tab ? 0 : to > tab ? -w : w;
    if (to !== tab) leaving.current = true;
    // One spring moves the page and the tab beside it together, starting at his finger's speed
    ospring.current = animateSpring(d.dx, target, placeOverlay, {
      ...TAB_SPRING,
      velocity: clampV(vx * 1000),
      onDone: () => {
        ospring.current = null;
        releaseSnap();
        if (to === tab) {
          // Not far enough: the page is back over its tab
          setBubble(tab);
          dropGhost(tab);
          return;
        }
        // The page has left on the side he swiped to and the next tab is in place: the address follows
        router.push(TAB_PATHS[to], { scroll: false });
      },
    });
  };

  // ---- The left page's picture (Step 55) ----
  // When he leaves a page on top (the course) for another tab, a still copy of it stays in that tab's place
  // in the strip. Swiping back, he sees the course slide in, not the top of Man; then the real page opens
  // over it at the same scroll position and the copy goes away.
  const ghostHosts = useRef<(HTMLDivElement | null)[]>([]);
  const ghosts = useRef<Record<number, { node: HTMLElement; scrollTop: number; path: string }>>({});

  const paintGhost = useCallback((i: number) => {
    const host = ghostHosts.current[i];
    if (!host) return;
    const g = ghosts.current[i];
    if (!g) {
      host.replaceChildren();
      host.hidden = true;
      return;
    }
    g.node.style.transform = `translateY(${-g.scrollTop}px)`;
    host.replaceChildren(g.node);
    host.hidden = false;
  }, []);

  const snapshot = useCallback(() => {
    const ov = overlay.current;
    const page = ov?.firstElementChild as HTMLElement | null;
    if (!ov || !page || tab < 0) return;
    const node = page.cloneNode(true) as HTMLElement;
    node.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    node.querySelectorAll("video, audio, iframe").forEach((n) => n.remove());
    ghosts.current[tab] = { node, scrollTop: ov.scrollTop, path: window.location.pathname + window.location.search };
    paintGhost(tab);
  }, [tab, paintGhost]);

  const dropGhost = useCallback(
    (i: number) => {
      if (!ghosts.current[i]) return;
      delete ghosts.current[i];
      paintGhost(i);
    },
    [paintGhost],
  );

  // Taps on the tab bar or the sidebar while on a page on top: take the picture before the address changes
  useEffect(() => {
    if (onRoot) return;
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest?.("nav[aria-label='Main'], aside")) snapshot();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [onRoot, snapshot]);

  // ---- Each tab remembers the page he left it on (Step 54) ----
  // He's on the course (Man), swipes or taps over to Me, then comes back to Man: the course opens again,
  // not the top of Man. Going back to a tab's top himself (Back, or tapping the tab he's on) forgets it.
  const prevPath = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevPath.current;
    const here = pathname + window.location.search;
    prevPath.current = here;
    if (!prev) return;
    const prevPathname = prev.split("?")[0];
    const from = tabFor(prevPathname);
    const to = tabFor(pathname);
    if (from === to) {
      if (onRoot) {
        tabMemory.forget(to); // back to this tab's top on purpose
        dropGhost(to);
      }
      return;
    }
    // Leaving a page opened on top of a tab for another tab: remember it
    if (from >= 0 && !isTabRoot(prevPathname)) tabMemory.remember(from, prev.replace(/([?&])play=1(&|$)/, "$1").replace(/[?&]$/, ""));
    // Arriving at the top of a tab he had left on a page: open that page again
    if (to >= 0 && onRoot) {
      const back = tabMemory.take(to);
      if (back && back.split("?")[0] !== pathname) router.push(back, { scroll: false });
    }
  }, [pathname, onRoot, router, dropGhost]);

  // A new page on top starts in place (after a swipe away, the next one must not open off-screen).
  // If it's the page he left earlier, it opens at the same scroll position and its picture goes away.
  useEffect(() => {
    leaving.current = false;
    const ov = overlay.current;
    if (ov) {
      ov.style.transition = "";
      ov.style.transform = "";
    }
    const g = tab >= 0 ? ghosts.current[tab] : undefined;
    if (!g) return;
    if (onRoot) return; // still on the tab's top: keep the picture until the page itself opens
    const here = pathname + window.location.search;
    if (g.path.split("?")[0] !== pathname) {
      dropGhost(tab);
      return;
    }
    let tries = 0;
    const restore = () => {
      const o = overlay.current;
      if (o && (o.scrollHeight - o.clientHeight >= g.scrollTop - 2 || tries > 30)) {
        o.scrollTop = g.scrollTop;
        requestAnimationFrame(() => dropGhost(tab));
        return;
      }
      tries++;
      requestAnimationFrame(restore);
    };
    void here;
    requestAnimationFrame(restore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
            <div className="mx-auto max-w-md px-1 pb-32 pt-6 lg:max-w-6xl lg:px-10 lg:pb-14 lg:pt-8">
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`tab-strip ${placed ? "opacity-100" : "opacity-0"}`}
        inert={!onRoot}
        aria-hidden={!onRoot}
      >
        {panels}
        {/* A still picture of the page each tab was left on (Step 55), sitting in that tab's place */}
        {TAB_PATHS.map((p, i) => (
          <div
            key={p}
            ref={(el) => {
              ghostHosts.current[i] = el;
            }}
            className="tab-ghost"
            style={{ left: `${i * 100}%` }}
            hidden
            aria-hidden
            inert
          />
        ))}
      </div>

      {!onRoot && (
        <div
          ref={overlay}
          className="overlay-page"
          id="overlay-page"
          onPointerDown={onOverlayDown}
          onPointerMove={onOverlayMove}
          onPointerUp={endOverlayDrag}
          onPointerCancel={endOverlayDrag}
        >
          <div className="mx-auto max-w-md px-1 pb-32 pt-6 lg:max-w-3xl lg:px-10 lg:pb-14 lg:pt-8">{children}</div>
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
