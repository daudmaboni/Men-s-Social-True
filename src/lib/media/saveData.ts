"use client";

// Step 90: "Save data" for cheap phones and expensive bundles. Set in Me → Settings: Auto, On or Off.
//  Auto (default): on when the phone says Data Saver is on, or the connection is 2G/3G.
//  On: reels in the feed don't play by themselves (a tap plays them), photos come smaller, and cards open on
//      their words instead of a photo.
// Kept on this phone only.

import { useEffect, useState, useSyncExternalStore } from "react";
import { lowData } from "./image";

export type SaveDataPref = "auto" | "on" | "off";
const KEY = "ms_save_data";
const listeners = new Set<() => void>();

export function saveDataPref(): SaveDataPref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "on" || v === "off" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function setSaveDataPref(p: SaveDataPref) {
  try {
    if (p === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, p);
  } catch {}
  listeners.forEach((l) => l());
}

/** Is saving data on, given his choice and the connection? Pure, so it's tested. */
export const savingData = (pref: SaveDataPref, slow: boolean) => pref === "on" || (pref === "auto" && slow);

/** Save data on right now? (Read after the first draw; the connection can change while he uses the app.) */
export function useSaveData(): boolean {
  const pref = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    saveDataPref,
    () => "off" as SaveDataPref,
  );
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(lowData());
    const c = (navigator as Navigator & { connection?: EventTarget }).connection;
    const on = () => setSlow(lowData());
    c?.addEventListener?.("change", on);
    return () => c?.removeEventListener?.("change", on);
  }, []);
  return savingData(pref, slow);
}

export function useSaveDataPref(): SaveDataPref {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    saveDataPref,
    () => "auto" as SaveDataPref,
  );
}
