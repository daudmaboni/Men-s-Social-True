"use client";

// "Next in 10": a small ring that empties over 10 seconds, with Cancel (Step 49).
// Sits at the top right of the lesson card; when it reaches 0 the next lesson comes up.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { COUNTDOWN_MS, coursePlayer, useCoursePlayer } from "@/lib/course/player";
import { useT } from "@/lib/i18n";

export default function Countdown({ forLesson, tone = "dark", className = "" }: { forLesson: string; tone?: "dark" | "light"; className?: string }) {
  const p = useCoursePlayer();
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  const active = p.countdown && p.lesson?.id === forLesson;
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [active]);
  if (!active || !p.countdown) return null;

  const left = Math.max(0, p.countdown.endsAt - now);
  const secs = Math.ceil(left / 1000);
  const R = 15;
  const C = 2 * Math.PI * R;
  const dark = tone === "dark";

  return (
    <div
      className={`countdown-in flex items-center gap-2 rounded-full py-1 pl-1 pr-1 ${dark ? "bg-white/15 text-white" : "bg-surface text-ink ring-1 ring-line"} ${className}`}
      role="timer"
      aria-live="polite"
      aria-label={t("Next lesson in {n} seconds", { n: secs })}
    >
      <span className="relative flex h-9 w-9 items-center justify-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r={R} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r={R}
            fill="none"
            stroke="var(--mint-strong)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - left / COUNTDOWN_MS)}
          />
        </svg>
        <span className="text-sm font-bold tabular-nums">{secs}</span>
      </span>
      <span className="text-[11px] font-semibold leading-tight">{t("Next lesson")}</span>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          coursePlayer.cancelCountdown();
        }}
        className={`flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold ${dark ? "bg-white/15 hover:bg-white/25" : "bg-bg hover:bg-line"}`}
        aria-label={t("Cancel")}
      >
        <X size={13} /> {t("Cancel")}
      </button>
    </div>
  );
}
