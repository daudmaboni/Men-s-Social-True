"use client";

// Mounted once in the app (Step 56). While the app is on screen it notes the time (only if he turned on the
// automatic sleep estimate), and each time he opens it, it finishes last night if it can (sleepTracker).

import { useEffect } from "react";
import { sleepTracker } from "@/lib/progress/sleepTracker";
import { progressSync } from "@/lib/progress/store";

export default function SleepWatcher() {
  useEffect(() => {
    const visible = () => document.visibilityState === "visible";
    const tick = () => {
      if (!visible()) return;
      sleepTracker.noteSeen();
    };
    const onShow = () => {
      if (!visible()) return;
      sleepTracker.noteSeen();
      sleepTracker.checkMorning(progressSync.get().records);
    };
    onShow();
    const id = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("pagehide", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("pagehide", tick);
    };
  }, []);
  return null;
}
