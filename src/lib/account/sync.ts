"use client";

// Keeps his phone and his account in step.
// - When he signs in: phone data + account data are merged (nothing lost), then saved to both.
// - After that: every change he makes is saved to his account a moment later.
// - Offline: changes wait, and are saved when the connection comes back.

import { getSupabase } from "../supabase/client";
import { feedSync } from "../feed/store";
import { progressSync } from "../progress/store";
import { socialSync } from "../social/store";
import { mergeFeed, mergeProgress, mergeSocial } from "./merge";

export type Kind = "progress" | "feed" | "social";
export type SyncStatus = "idle" | "syncing" | "saved" | "offline" | "error";

/* eslint-disable @typescript-eslint/no-explicit-any */
const STORES: Record<Kind, { get: () => any; replace: (db: any) => void; clear: () => void; onChange: (cb: () => void) => () => void; merge: (local: any, remote: any, userId: string) => any }> = {
  progress: { ...progressSync, merge: (l, r, u) => mergeProgress(l, r, u) },
  feed: { ...feedSync, merge: (l, r) => mergeFeed(l, r) },
  social: { ...socialSync, merge: (l, r) => mergeSocial(l, r) },
};
/* eslint-enable @typescript-eslint/no-explicit-any */
const KINDS = Object.keys(STORES) as Kind[];

// One snapshot object per change (screens compare it by reference)
let snapshot: { status: SyncStatus; lastSaved: string | null } = { status: "idle", lastSaved: null };
const statusListeners = new Set<() => void>();
function setStatus(s: SyncStatus) {
  snapshot = { status: s, lastSaved: s === "saved" ? new Date().toISOString() : snapshot.lastSaved };
  statusListeners.forEach((l) => l());
}
export const syncStatus = {
  get: () => snapshot,
  subscribe(cb: () => void) {
    statusListeners.add(cb);
    return () => {
      statusListeners.delete(cb);
    };
  },
};

let current: { userId: string; stop: () => void } | null = null;
const pending = new Set<Kind>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function push(userId: string, kinds: Kind[]) {
  const sb = getSupabase();
  if (!sb || kinds.length === 0) return;
  setStatus("syncing");
  const rows = kinds.map((kind) => ({ user_id: userId, kind, data: STORES[kind].get() }));
  const { error } = await sb.from("user_data").upsert(rows);
  if (error) {
    kinds.forEach((k) => pending.add(k));
    setStatus(navigator.onLine ? "error" : "offline");
    return;
  }
  setStatus("saved");
}

function schedule(userId: string, kind: Kind) {
  pending.add(kind);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const kinds = [...pending];
    pending.clear();
    void push(userId, kinds);
  }, 1200);
}

/** Start keeping this phone and his account in step. Safe to call again for the same man. */
export async function startSync(userId: string): Promise<void> {
  if (current?.userId === userId) return;
  current?.stop();
  const sb = getSupabase();
  if (!sb) return;

  setStatus("syncing");
  const { data, error } = await sb.from("user_data").select("kind, data").eq("user_id", userId);
  if (error) {
    setStatus(navigator.onLine ? "error" : "offline");
  } else {
    const remote = new Map((data ?? []).map((r: { kind: Kind; data: unknown }) => [r.kind, r.data]));
    for (const k of KINDS) STORES[k].replace(STORES[k].merge(STORES[k].get(), remote.get(k) ?? null, userId));
    await push(userId, KINDS);
  }

  const offs = KINDS.map((k) => STORES[k].onChange(() => schedule(userId, k)));
  const retry = () => {
    if (pending.size) schedule(userId, [...pending][0]);
  };
  window.addEventListener("online", retry);
  current = {
    userId,
    stop: () => {
      offs.forEach((off) => off());
      window.removeEventListener("online", retry);
      if (timer) clearTimeout(timer);
      pending.clear();
    },
  };
  // If loading failed, try a full sync again when he's back online
  if (error) window.addEventListener("online", () => current?.userId === userId && (current.stop(), (current = null), startSync(userId)), { once: true });
}

/** Save anything waiting right now (e.g. before signing out). */
export async function flushSync() {
  if (!current) return;
  if (timer) clearTimeout(timer);
  const kinds = [...pending];
  pending.clear();
  await push(current.userId, kinds);
}

/** Stop syncing. With clearPhone, his data is removed from this phone (it stays safe in his account). */
export function stopSync({ clearPhone }: { clearPhone: boolean }) {
  current?.stop();
  current = null;
  if (clearPhone) KINDS.forEach((k) => STORES[k].clear());
  setStatus("idle");
}

/** Delete his saved data from his account (the account itself stays). */
export async function deleteCloudData(userId: string) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("user_data").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
}
