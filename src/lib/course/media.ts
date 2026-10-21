"use client";

// Lesson files are private (Step 59). The course stores "private:course-media/<path>" instead of a
// public web address; to play a lesson, the app asks Supabase for a link that works for one day.
// Only a signed-in man can get one (the database checks: migration 0010). Links are asked for all
// lessons at once when the course loads, and remembered on the phone, so lessons still start instantly.
// Old public addresses (from before the move) keep working as they are.

import { useEffect, useSyncExternalStore } from "react";
import { getSupabase } from "../supabase/client";
import type { Course } from "./types";

export const PRIVATE_BUCKET = "course-media";
const PREFIX = `private:${PRIVATE_BUCKET}/`;
export const LINKS_KEY = "ms_media_links_v1";
const LIFETIME_S = 24 * 3600; // how long a link works
const RENEW_BEFORE_MS = 3 * 3600_000; // ask again when less than this is left

type Link = { url: string; exp: number };
let links: Record<string, Link> | null = null;
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;

export const isPrivateRef = (ref: string | undefined | null): ref is string => Boolean(ref?.startsWith(PREFIX));
export const privateRef = (path: string) => `${PREFIX}${path}`;
const pathOf = (ref: string) => ref.slice(PREFIX.length);

function all(): Record<string, Link> {
  if (links) return links;
  try {
    links = JSON.parse(localStorage.getItem(LINKS_KEY) ?? "{}") as Record<string, Link>;
  } catch {
    links = {};
  }
  return links;
}
function keep(next: Record<string, Link>) {
  links = next;
  try {
    localStorage.setItem(LINKS_KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

/** Lessons downloaded to the phone (Step 67, offline/downloads.ts): ref → a local address that works with no internet. */
const offline: Record<string, string> = {};
export function setOfflineUrl(ref: string, url: string | null) {
  const old = offline[ref];
  if (old && old !== url) URL.revokeObjectURL(old);
  if (url) offline[ref] = url;
  else delete offline[ref];
  listeners.forEach((l) => l());
}
export const isOffline = (ref: string | undefined | null) => Boolean(ref && offline[ref]);

/** The address to play right now: the copy on the phone if he downloaded it, a public address as it is,
 *  a private file's current link, or "" while it's being fetched. */
export function playable(ref: string | undefined | null, now = Date.now()): string {
  if (!ref) return "";
  if (offline[ref]) return offline[ref];
  if (!isPrivateRef(ref)) return ref;
  const l = all()[ref];
  return l && l.exp > now + 60_000 ? l.url : "";
}

/** Ask for links for these files (one request), skipping ones that are still good for a few hours. */
export function fetchLinks(refs: string[], now = Date.now()): Promise<void> {
  const need = [...new Set(refs.filter(isPrivateRef))].filter((r) => !(all()[r]?.exp > now + RENEW_BEFORE_MS));
  if (!need.length) return inFlight ?? Promise.resolve();
  const run = async () => {
    const sb = getSupabase();
    if (!sb) return;
    const { data, error } = await sb.storage.from(PRIVATE_BUCKET).createSignedUrls(need.map(pathOf), LIFETIME_S);
    if (error || !data) return;
    const exp = Date.now() + LIFETIME_S * 1000;
    const next = { ...all() };
    for (const row of data) if (row.signedUrl && row.path) next[privateRef(row.path)] = { url: row.signedUrl, exp };
    // Forget links that ran out
    for (const [k, v] of Object.entries(next)) if (v.exp < Date.now()) delete next[k];
    keep(next);
  };
  const p = (inFlight ?? Promise.resolve()).then(run).finally(() => {
    if (inFlight === p) inFlight = null;
  });
  inFlight = p;
  return p;
}

/** The link for one file, fetching it if needed ("" if he isn't allowed or is offline). */
export async function linkFor(ref: string): Promise<string> {
  if (offline[ref]) return offline[ref];
  if (!isPrivateRef(ref)) return ref;
  if (!playable(ref)) await fetchLinks([ref]);
  return playable(ref);
}

/** Every private file a course uses. */
export function courseRefs(c: Course): string[] {
  return c.modules.flatMap((m) => m.lessons.map((l) => l.mediaUrl)).filter(isPrivateRef);
}

/** Forget all links (on sign-out). */
export function forgetLinks() {
  keep({});
}

/** For screens: the address to give an <audio>/<video>, updated when the link arrives. */
export function useMediaSrc(ref: string | undefined | null): string {
  const src = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => playable(ref),
    () => (isPrivateRef(ref) ? "" : (ref ?? "")),
  );
  useEffect(() => {
    if (isPrivateRef(ref) && !src) void fetchLinks([ref]);
  }, [ref, src]);
  return src;
}
