"use client";

// His in-app inbox (migration 0006): messages from the Men's Social team.
// Opening the inbox marks them delivered; tapping one marks it opened (that's all the team sees: counts).

import { useSyncExternalStore } from "react";
import { getSupabase } from "../supabase/client";

export type InboxItem = { id: string; title: string; body: string; kind: string; link: string | null; sent_at: string; opened: boolean };
type State = { status: "idle" | "loading" | "ready" | "unavailable"; items: InboxItem[] };

let state: State = { status: "idle", items: [] };
const listeners = new Set<() => void>();
const set = (s: Partial<State>) => {
  state = { ...state, ...s };
  listeners.forEach((l) => l());
};

let last = 0;
export async function refreshInbox(force = false) {
  const sb = getSupabase();
  if (!sb) return set({ status: "unavailable" });
  if (!force && Date.now() - last < 60_000) return;
  last = Date.now();
  const { data: s } = await sb.auth.getSession();
  if (!s.session) return set({ status: "unavailable", items: [] });
  if (state.status === "idle") set({ status: "loading" });
  const { data, error } = await sb.rpc("my_notifications");
  if (error) return set({ status: /could not find|does not exist/i.test(error.message) ? "unavailable" : "ready" });
  set({ status: "ready", items: (data ?? []) as InboxItem[] });
}

export async function markOpened(id: string) {
  set({ items: state.items.map((i) => (i.id === id ? { ...i, opened: true } : i)) });
  await getSupabase()?.rpc("my_notification_opened", { p_id: id });
}

export function useInbox() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

export type Prefs = { announcements: boolean; new_content: boolean; tips: boolean; community: boolean };
export const DEFAULT_PREFS: Prefs = { announcements: true, new_content: true, tips: true, community: true };

export async function loadPrefs(): Promise<Prefs | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: s } = await sb.auth.getSession();
  if (!s.session) return null;
  const { data, error } = await sb.from("notification_prefs").select("announcements,new_content,tips,community").eq("user_id", s.session.user.id).maybeSingle();
  if (error) return null;
  return { ...DEFAULT_PREFS, ...(data ?? {}) };
}

export async function savePrefs(p: Prefs) {
  const sb = getSupabase();
  const { data: s } = (await sb?.auth.getSession()) ?? { data: { session: null } };
  if (!sb || !s.session) throw new Error("Please sign in.");
  const { error } = await sb.from("notification_prefs").upsert({ user_id: s.session.user.id, ...p, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
