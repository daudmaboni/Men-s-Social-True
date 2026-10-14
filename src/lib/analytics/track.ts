"use client";

// Privacy-first counters for the admin dashboard (see migration 0006):
// - which content was opened / finished / saved, counted per day with NO link to who
// - search words per day (phone numbers and emails are never stored)
// - the days a signed-in man opened the app (for daily/monthly active users)
// Nothing here ever blocks the app: if it fails (offline, database not updated yet) it's silently skipped.

import { getSupabase } from "../supabase/client";

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
export function trackContent(id: string, event: "view" | "complete" | "save") {
  const key = `${event}:${id}`;
  if (event !== "save" && seen.has(key)) return;
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
/** A signed-in man used the app today (once a day). */
export function touchActivity() {
  const today = new Date().toISOString().slice(0, 10);
  if (touched === today) return;
  touched = today;
  call("touch_activity", {});
}
