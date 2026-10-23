"use client";

// Privacy-first counters for the admin dashboard (see migration 0006):
// - which content was opened / finished / saved, counted per day with NO link to who
// - search words per day (phone numbers and emails are never stored)
// - the days a signed-in man opened the app (for daily/monthly active users), with his language
//   and which app he uses (Android app, home-screen app or browser) — shown on his Admin → Users page (Step 65)
// Nothing here ever blocks the app: if it fails (offline, database not updated yet) it's silently skipped.

import { Capacitor } from "@capacitor/core";
import { getSupabase } from "../supabase/client";
import { currentLang } from "../me/lang";

const seen = new Set<string>();

function call(fn: string, args: Record<string, unknown>) {
  const sb = getSupabase();
  if (!sb) return;
  void sb.rpc(fn, args).then(
    () => {},
    () => {},
  );
}

/** He opened, finished or saved a piece of content. Views count once per app session. */
export type ContentEvent =
  | "view"
  | "complete"
  | "save"
  | "helped_yes"
  | "helped_some"
  | "helped_no"
  // Step 86
  | "heart"
  | "unheart"
  | "share"
  | "challenge_start"
  | "challenge_finish";
const ONCE: ContentEvent[] = ["view", "complete"];

export function trackContent(id: string, event: ContentEvent) {
  const key = `${event}:${id}`;
  if (ONCE.includes(event) && seen.has(key)) return;
  seen.add(key);
  call("track_content", { p_id: id, p_event: event });
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
/** A search he settled on (waits until he stops typing). */
export function trackSearch(term: string, results: number) {
  if (searchTimer) clearTimeout(searchTimer);
  const t = term.trim();
  if (t.length < 2) return;
  searchTimer = setTimeout(() => call("track_search", { p_term: t, p_results: results }), 1200);
}

let touched = "";

/** Which app he's using: the Android app, the app added to his home screen, or a browser. */
export function appPlatform(): "android" | "ios" | "pwa" | "web" {
  try {
    if (Capacitor.isNativePlatform()) return Capacitor.getPlatform() === "ios" ? "ios" : "android";
    if (window.matchMedia?.("(display-mode: standalone)").matches) return "pwa";
  } catch {}
  return "web";
}

/** A signed-in man used the app today (once a day, or again when he changes language). */
export function touchActivity() {
  const lang = currentLang();
  const key = `${new Date().toISOString().slice(0, 10)}:${lang}`;
  if (touched === key) return;
  touched = key;
  const sb = getSupabase();
  if (!sb) return;
  void sb.rpc("touch_activity", { p_lang: lang, p_platform: appPlatform() }).then(
    // Database not updated to 0012 yet: the old version still counts the day
    ({ error }) => error && call("touch_activity", {}),
    () => {},
  );
}
