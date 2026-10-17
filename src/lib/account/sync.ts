"use client";

// Keeps his phone and his account in step.
// - When he signs in: phone data + account data are merged (nothing lost), then saved to both.
// - After that: every change he makes is saved to his account a moment later.
// - Every save first reads the account copy and merges it in, so a second phone's changes
//   (including deletions) are never overwritten. If another phone saved in between, it merges again.
// - When he comes back to the app, it picks up what he changed on his other phones.
// - Offline: changes wait, and are saved when the connection comes back.

import { getSupabase } from "../supabase/client";
import { feedSync } from "../feed/store";
import { progressSync } from "../progress/store";
import { socialSync } from "../social/store";
import { mergeFeed, mergeProgress, mergeSocial } from "./merge";
import { sameData } from "./tombstones";

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
/** Saves started by sync itself (not by him) in a row — a safety stop against endless saving. */
const followUps: Record<Kind, number> = { progress: 0, feed: 0, social: 0 };
const MAX_TRIES = 4;
const REFRESH_EVERY_MS = 20_000;
let lastRefresh = 0;

class SyncError extends Error {}

/**
 * Bring one kind of data in step: read his account copy, merge with this phone, save the result
 * only if it changed — and only if no other phone saved in between (otherwise read and merge again).
 */
async function syncKind(userId: string, kind: Kind): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const store = STORES[kind];
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const { data: row, error } = await sb.from("user_data").select("data, updated_at").eq("user_id", userId).eq("kind", kind).maybeSingle();
    if (error) throw new SyncError(error.message);
    const sent = store.get();
    const merged = store.merge(sent, row?.data ?? null, userId);
    if (!row || !sameData(merged, row.data)) {
      if (row) {
        const { data: saved, error: e } = await sb
          .from("user_data")
          .update({ data: merged })
          .eq("user_id", userId)
          .eq("kind", kind)
          .eq("updated_at", row.updated_at)
          .select("updated_at");
        if (e) throw new SyncError(e.message);
        if (!saved?.length) continue; // another phone saved first → read again and merge
      } else {
        const { error: e } = await sb.from("user_data").insert({ user_id: userId, kind, data: merged });
        if (e?.code === "23505") continue; // another phone created it first → read again and merge
        if (e) throw new SyncError(e.message);
      }
    }
    // Show the merged data on this phone, keeping anything he changed while we were saving
    const now = store.get();
    const next = store.merge(now, merged, userId);
    if (!sameData(next, now)) store.replace(next);
    if (!sameData(next, merged)) {
      // He changed something meanwhile (or the phone tidied the data): save once more
      if (++followUps[kind] <= MAX_TRIES) schedule(userId, kind, true);
    } else followUps[kind] = 0;
    return;
  }
  throw new SyncError("Account is busy, will try again");
}

async function push(userId: string, kinds: Kind[]) {
  if (!getSupabase() || kinds.length === 0) return;
  setStatus("syncing");
  let failed = false;
  // Step 58: the kinds are separate rows, so they're saved at the same time (before: one after another,
  // so the waits added up — about 3 round trips on every open)
  await Promise.all(
    kinds.map((kind) =>
      syncKind(userId, kind).catch(() => {
        pending.add(kind);
        failed = true;
      }),
    ),
  );
  if (failed) setStatus(navigator.onLine ? "error" : "offline");
  else setStatus("saved");
}

function schedule(userId: string, kind: Kind, fromSync = false) {
  if (!fromSync) followUps[kind] = 0;
  pending.add(kind);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const kinds = [...pending];
    pending.clear();
    void push(userId, kinds);
  }, 1200);
}

/** Start keeping this phone and his account in step. Safe to call again for the same man. */
export async function startSync(userId: string): Promise<void> {
  if (current?.userId === userId) return;
  current?.stop();
  if (!getSupabase()) return;

  // First sign-in on this phone (or coming back): merge both sides and save to both
  await push(userId, KINDS);
  lastRefresh = Date.now();
  const failed = snapshot.status === "error" || snapshot.status === "offline";

  const offs = KINDS.map((k) => STORES[k].onChange(() => schedule(userId, k)));
  const retry = () => {
    const kinds = pending.size ? [...pending] : failed ? KINDS : [];
    kinds.forEach((k) => schedule(userId, k));
  };
  // Back in the app (another phone may have changed things): pick up the changes
  const refresh = () => {
    if (document.visibilityState !== "visible" || Date.now() - lastRefresh < REFRESH_EVERY_MS) return;
    lastRefresh = Date.now();
    KINDS.forEach((k) => schedule(userId, k, true));
  };
  window.addEventListener("online", retry);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
  current = {
    userId,
    stop: () => {
      offs.forEach((off) => off());
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      if (timer) clearTimeout(timer);
      timer = null;
      pending.clear();
    },
  };
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
