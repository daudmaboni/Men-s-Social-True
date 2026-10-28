"use client";

// The mini player (Step 49): when a lesson is playing and he leaves its page — another tab, an article,
// anything — it pops up above the bottom bar so the sound never stops and he can always control it.
// Tap it to go back to the lesson; ✕ stops and closes it (his place is saved).
// Step 77: it moves with his finger. Swipe it up to open the lesson; swipe it sideways off the screen to stop.

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { animateSpring, project, releaseVelocity, rubberband, type SpringHandle } from "@/lib/motion/spring";
import { haptic } from "@/lib/motion/haptics";
import { Pause, Play, X } from "lucide-react";
import CourseArt from "./CourseArt";
import Countdown from "./Countdown";
import { coursePlayer, useCourseCardOnScreen, useCoursePlayer } from "@/lib/course/player";
import { useFeed } from "@/lib/feed/store";
import { useT } from "@/lib/i18n";

/** Is the mini player on screen right now? (Kito's button moves up out of its way, Step 67.) */
export function useMiniPlayerVisible(): boolean {
  const p = useCoursePlayer();
  const pathname = usePathname();
  const cardShown = useCourseCardOnScreen();
  const l = p.lesson;
  // Not on the lesson's own page (it has the big player), not in the Studio or sign-in screens
  if (!l || pathname === `/man/course/${l.id}` || pathname.startsWith("/studio") || pathname.startsWith("/account")) return false;
  // The course card on the Man tab is on screen and already has the controls
  if (cardShown && pathname === "/man") return false;
  // Only once he has actually started it
  return Boolean(p.playing || p.countdown || p.time >= 1 || p.ended);
}

export default function MiniPlayer() {
  const p = useCoursePlayer();
  const feed = useFeed();
  const router = useRouter();
  const t = useT();
  const visible = useMiniPlayerVisible();
  const l = p.lesson;
  const box = useRef<HTMLDivElement>(null);
  const pose = useRef({ x: 0, y: 0 });
  const anim = useRef<{ x?: SpringHandle; y?: SpringHandle }>({});
  const drag = useRef<{ id: number; x0: number; y0: number; axis: "x" | "y" | null; sx: { t: number; x: number }[]; sy: { t: number; x: number }[] } | null>(null);
  // Step 89: the lesson page is fetched ahead, so a tap or swipe up opens it at once
  const lessonId = l?.id;
  useEffect(() => {
    if (visible && lessonId) router.prefetch(`/man/course/${lessonId}`);
  }, [router, visible, lessonId]);
  if (!visible || !l) return null;

  const place = (x: number, y: number) => {
    pose.current = { x, y };
    const el = box.current;
    if (!el) return;
    const w = el.offsetWidth || 340;
    // Sideways it fades as it goes; upwards it grows a touch, as if lifting into the lesson page
    el.style.transform = x || y ? `translate3d(${x}px, ${y}px, 0) scale(${1 + Math.min(0.06, Math.max(0, -y) / 1500)})` : "";
    el.style.opacity = String(Math.max(0, 1 - Math.abs(x) / w));
  };
  const springX = (to: number, v: number, done?: () => void) => {
    anim.current.x?.stop();
    anim.current.x = animateSpring(pose.current.x, to, (x) => place(x, pose.current.y), { damping: 1, response: 0.3, velocity: v, onDone: done });
  };
  const springY = (to: number, v: number, done?: () => void) => {
    anim.current.y?.stop();
    anim.current.y = animateSpring(pose.current.y, to, (y) => place(pose.current.x, y), { damping: 1, response: 0.3, velocity: v, onDone: done });
  };
  const onDown = (e: React.PointerEvent) => {
    if (!e.isPrimary || e.pointerType === "mouse") return;
    anim.current.x?.stop();
    anim.current.y?.stop();
    if (box.current) box.current.style.animation = "none"; // the pop-in animation would hold its own position
    const now = performance.now();
    drag.current = { id: e.pointerId, x0: e.clientX - pose.current.x, y0: e.clientY - pose.current.y, axis: null, sx: [{ t: now, x: e.clientX }], sy: [{ t: now, x: e.clientY }] };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.axis) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      try {
        box.current?.setPointerCapture(e.pointerId); // the buttons inside won't also get a tap
      } catch {}
    }
    if (d.axis === "x") place(dx, 0);
    else place(0, dy < 0 ? dy : rubberband(dy, 200, 0.3)); // down only stretches
    const now = performance.now();
    d.sx.push({ t: now, x: e.clientX });
    d.sy.push({ t: now, x: e.clientY });
    while (d.sx.length > 2 && now - d.sx[0].t > 100) d.sx.shift();
    while (d.sy.length > 2 && now - d.sy[0].t > 100) d.sy.shift();
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || !d.axis) return;
    const w = box.current?.offsetWidth || 340;
    if (d.axis === "x") {
      const v = releaseVelocity(d.sx);
      const at = pose.current.x + project(v);
      if (Math.abs(at) > w * 0.45 || (Math.abs(v) > 700 && Math.sign(v) === Math.sign(pose.current.x))) {
        // Thrown off the side: stop the lesson (his place is saved)
        haptic("tick");
        springX(Math.sign(at || v) * (w + 40), v, () => {
          coursePlayer.stop();
          place(0, 0);
        });
      } else springX(0, v);
      return;
    }
    const v = releaseVelocity(d.sy);
    if (pose.current.y < -56 || v < -500) {
      haptic("tick");
      open();
    }
    springY(0, v);
  };

  const discreet = feed.settings.discreet;
  const pct = p.duration ? Math.min(100, (p.time / p.duration) * 100) : 0;
  const open = () => router.push(`/man/course/${l.id}`);


  return (
    <div
      ref={box}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      style={{ touchAction: "none" }}
      data-own-swipe
      className="mini-in fixed inset-x-3 z-30 mx-auto max-w-md bottom-[calc(max(12px,env(safe-area-inset-bottom))+84px)] lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0 lg:w-[380px]">
      <div className="glass-card overflow-hidden rounded-2xl shadow-xl ring-1 ring-line [--nest-r:16px] [--nest-p:10px] [--nest-min:6px]">
        <div className="flex items-center gap-3 p-2.5">
          <button onClick={open} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={t("Open the lesson")}>
            <CourseArt className={`concentric h-11 w-11 shrink-0 ${p.playing ? "mini-pulse" : ""}`} size={18} />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.6875rem] font-semibold text-forest">{t("Lesson {n}", { n: l.number })}</span>
              <span className="block truncate text-sm font-semibold">{discreet ? "Men's Social" : l.title}</span>
            </span>
          </button>
          {p.countdown ? (
            <Countdown forLesson={l.id} tone="light" />
          ) : (
            <>
              <button
                onClick={() => coursePlayer.toggle()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest text-white transition-transform active:scale-95"
                aria-label={p.playing ? t("Pause") : t("Play")}
              >
                {p.playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="translate-x-px" />}
              </button>
              <button
                onClick={() => coursePlayer.stop()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-bg"
                aria-label={t("Stop and close")}
              >
                <X size={17} />
              </button>
            </>
          )}
        </div>
        {/* How far into the lesson */}
        <div className="h-1 bg-line">
          <div className="h-full bg-forest transition-[width] duration-300 ease-linear" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
