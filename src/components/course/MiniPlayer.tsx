"use client";

// The mini player (Step 49): when a lesson is playing and he leaves its page — another tab, an article,
// anything — it pops up above the bottom bar so the sound never stops and he can always control it.
// Tap it to go back to the lesson; ✕ stops and closes it (his place is saved).

import { usePathname, useRouter } from "next/navigation";
import { Pause, Play, X } from "lucide-react";
import CourseArt from "./CourseArt";
import Countdown from "./Countdown";
import { coursePlayer, useCourseCardOnScreen, useCoursePlayer } from "@/lib/course/player";
import { useFeed } from "@/lib/feed/store";
import { useT } from "@/lib/i18n";

export default function MiniPlayer() {
  const p = useCoursePlayer();
  const feed = useFeed();
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const cardShown = useCourseCardOnScreen();
  const l = p.lesson;
  // Not on the lesson's own page (it has the big player), not in the Studio or sign-in screens
  if (!l || pathname === `/man/course/${l.id}` || pathname.startsWith("/studio") || pathname.startsWith("/account")) return null;
  // The course card on the Man tab is on screen and already has the controls
  if (cardShown && pathname === "/man") return null;
  // Only once he has actually started it
  if (!p.playing && !p.countdown && p.time < 1 && !p.ended) return null;

  const discreet = feed.settings.discreet;
  const pct = p.duration ? Math.min(100, (p.time / p.duration) * 100) : 0;
  const open = () => router.push(`/man/course/${l.id}`);

  return (
    <div className="mini-in fixed inset-x-3 z-30 mx-auto max-w-md bottom-[calc(max(12px,env(safe-area-inset-bottom))+84px)] lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0 lg:w-[380px]">
      <div className="glass-card overflow-hidden rounded-2xl shadow-xl ring-1 ring-line">
        <div className="flex items-center gap-3 p-2.5">
          <button onClick={open} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={t("Open the lesson")}>
            <CourseArt className={`h-11 w-11 shrink-0 rounded-xl ${p.playing ? "mini-pulse" : ""}`} size={18} />
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
