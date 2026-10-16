"use client";

// Google's sleep detection, when Men's Social runs as the Android app (Step 57).
// In a browser none of this exists: isNativeSleep() is false and the web features (taps, app-use estimate) are used.
// The native side (android/…/sleep/SleepPlugin.java) stores what Google detects; here we turn it into nights.

import { Capacitor, registerPlugin } from "@capacitor/core";
import { progressStore } from "../progress/store";
import { sessionMinutes } from "../progress/sleep";

export interface NativeStatus {
  available: boolean;
  permission: "granted" | "denied" | "prompt";
  enabled: boolean;
}
interface Segment {
  start: number;
  end: number;
  /** 0 = sleep detected; 1 = missing data; 2 = not detected */
  status: number;
  /** average 0–100 of Google's "asleep?" readings inside it, or -1 */
  confidence: number;
}
interface SleepTrackingPlugin {
  status(): Promise<NativeStatus>;
  start(): Promise<{ enabled: boolean }>;
  stop(opts?: { forget?: boolean }): Promise<{ enabled: boolean }>;
  getSegments(opts: { since: number }): Promise<{ segments: Segment[] }>;
  openSettings(): Promise<void>;
}

const SleepTracking = registerPlugin<SleepTrackingPlugin>("SleepTracking");

/** Running inside the Android app that has the sleep plugin. */
export function isNativeSleep(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("SleepTracking");
  } catch {
    return false;
  }
}

export const nativeSleep = {
  status: () => SleepTracking.status(),
  /** Asks for "Physical activity" if needed. Throws with code DENIED / UNAVAILABLE / FAILED. */
  start: () => SleepTracking.start(),
  stop: (forget = false) => SleepTracking.stop({ forget }),
  openSettings: () => SleepTracking.openSettings(),

  /**
   * Turn what Google detected (last 3 days) into nights. One per morning: the longest detected segment.
   * Saved as estimates ("Detected by your phone"); nights he entered or corrected are never replaced
   * (progressStore.saveNight), and a night he deleted isn't brought back (`imported`).
   */
  async importNights(imported: string[]): Promise<string[]> {
    const { segments } = await SleepTracking.getSegments({ since: Date.now() - 3 * 86400_000 });
    const best = new Map<string, Segment>();
    for (const s of segments) {
      if (s.status !== 0) continue;
      const minutes = sessionMinutes(new Date(s.start), new Date(s.end));
      if (minutes === null) continue;
      const day = new Date(s.end).toDateString();
      const cur = best.get(day);
      if (!cur || s.end - s.start > cur.end - cur.start) best.set(day, s);
    }
    const done = [...imported];
    for (const s of best.values()) {
      const key = `${s.start}-${s.end}`;
      if (done.includes(key)) continue;
      done.push(key);
      const minutes = sessionMinutes(new Date(s.start), new Date(s.end))!;
      progressStore.saveNight({
        startAt: new Date(s.start).toISOString(),
        endAt: new Date(s.end).toISOString(),
        minutes,
        how: "sleep_api",
        status: "estimated",
        confidence: s.confidence >= 0 ? s.confidence / 100 : 0.6,
      });
    }
    return done.slice(-60);
  },
};
