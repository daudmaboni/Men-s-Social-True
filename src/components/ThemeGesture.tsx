"use client";

// Two-finger gesture anywhere in the app:
//   spread fingers apart (like zooming in)  → dark mode
//   pinch fingers together (like zooming out) → light mode
// A small moon/sun bubble follows the fingers so he can see what will happen before letting go.

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { pinchResult, setThemePref, type Theme } from "@/lib/theme";
import { useToast } from "@/components/motion/Toast";

type Hint = { x: number; y: number; theme: Theme | null; scale: number };

const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
const mid = (t: TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });

export default function ThemeGesture() {
  const [hint, setHint] = useState<Hint | null>(null);
  const showToast = useToast();

  useEffect(() => {
    let start = 0;
    let last: Hint | null = null;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2 || document.querySelector("[role=dialog]")) return;
      start = dist(e.touches);
      last = null;
    };
    const onMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 2) return;
      e.preventDefault(); // stop the browser zooming the page
      const d = dist(e.touches);
      const m = mid(e.touches);
      last = { ...m, theme: pinchResult(start, d), scale: Math.min(Math.max(d / start, 0.5), 1.8) };
      setHint(last);
    };
    const onEnd = (e: TouchEvent) => {
      if (!start || e.touches.length > 0) return;
      start = 0;
      setHint(null);
      if (last?.theme) {
        const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
        setThemePref(last.theme, { x: last.x, y: last.y });
        if (current !== last.theme) showToast(last.theme === "dark" ? "Dark mode on" : "Light mode on");
      }
    };
    // iPhone Safari zoom gesture
    const stopSafariZoom = (e: Event) => e.preventDefault();

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    document.addEventListener("gesturestart", stopSafariZoom);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
      document.removeEventListener("gesturestart", stopSafariZoom);
    };
  }, [showToast]);

  if (!hint) return null;
  const dark = hint.theme === "dark";
  const ready = hint.theme !== null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-50 flex h-16 w-16 items-center justify-center rounded-full glass-bar"
      style={{ left: hint.x - 32, top: hint.y - 32, transform: `scale(${hint.scale})`, opacity: ready ? 1 : 0.6 }}
    >
      {hint.scale >= 1 ? <Moon size={26} className={dark ? "text-forest" : "text-ink-soft"} /> : <Sun size={26} className={ready ? "text-forest" : "text-ink-soft"} />}
    </div>
  );
}
