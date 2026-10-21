"use client";

// Offline learning (Step 67). He can save guides and course lessons on his phone and use them with no internet.
//  - Guides: a copy of the guide (text, both languages) is kept with the list below; its photo and page are
//    stored by the browser's offline store (Cache Storage), so the page opens offline.
//  - Lessons: the audio/video file itself is stored in Cache Storage. When a lesson is on the phone, the
//    player plays that copy (online too — it saves data).
// The list lives on the phone as "ms_downloads_v1". Nothing here goes to his account.

import { useSyncExternalStore } from "react";
import type { ContentItem } from "../content/types";
import { linkFor, setOfflineUrl } from "../course/media";

export const DOWNLOADS_KEY = "ms_downloads_v1";
export const OFFLINE_CACHE = "ms-offline-v1";

export type DownloadKind = "guide" | "lesson";
export interface Download {
  id: string;
  kind: DownloadKind;
  title: string;
  titleSw?: string;
  href: string;
  savedAt: string;
  bytes: number;
  status: "ready" | "failed";
  /** Guides: the copy shown offline. */
  item?: ContentItem;
  /** Lessons: the file (as stored in the course). */
  mediaRef?: string;
}

export interface DownloadsState {
  items: Record<string, Download>;
  /** Lessons downloading now: id → 0–100 */
  progress: Record<string, number>;
  ready: boolean;
}

const SERVER: DownloadsState = { items: {}, progress: {}, ready: false };
let state: DownloadsState | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const cacheKey = (ref: string) => `${location.origin}/__offline/media/${encodeURIComponent(ref)}`;
const hasCaches = () => typeof caches !== "undefined";

function load(): DownloadsState {
  if (state) return state;
  let items: Record<string, Download> = {};
  try {
    items = JSON.parse(localStorage.getItem(DOWNLOADS_KEY) ?? "{}") as Record<string, Download>;
  } catch {}
  state = { items, progress: {}, ready: true };
  void restoreFiles();
  return state;
}

function save(items: Record<string, Download>) {
  state = { ...load(), items };
  try {
    localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(items));
  } catch {
    // Phone storage full: the files are still cached, the list just didn't save
  }
  emit();
}

function setProgress(id: string, p: number | null) {
  const progress = { ...load().progress };
  if (p === null) delete progress[id];
  else progress[id] = p;
  state = { ...load(), progress };
  emit();
}

/** On open: give the player the lessons already on the phone; mark any the browser removed. */
let restored = false;
async function restoreFiles() {
  if (restored || !hasCaches()) return;
  restored = true;
  try {
    const cache = await caches.open(OFFLINE_CACHE);
    const items = { ...load().items };
    let changed = false;
    for (const d of Object.values(items)) {
      if (d.kind !== "lesson" || !d.mediaRef || d.status !== "ready") continue;
      const res = await cache.match(cacheKey(d.mediaRef));
      if (res) setOfflineUrl(d.mediaRef, URL.createObjectURL(await res.blob()));
      else {
        items[d.id] = { ...d, status: "failed" };
        changed = true;
      }
    }
    if (changed) save(items);
  } catch {}
}

/** Ask the browser not to clear these files when space runs low. */
function keepFiles() {
  void navigator.storage?.persist?.().catch(() => false);
}

/** Store a page (and the scripts it needs) so it opens with no internet. Best effort. */
async function keepPage(href: string) {
  try {
    const res = await fetch(href, { headers: { accept: "text/html" }, credentials: "same-origin" });
    if (!res.ok || !hasCaches()) return;
    const html = await res.clone().text();
    const pages = await caches.open("ms-pages-v1");
    await pages.put(new Request(new URL(href, location.origin).toString()), res);
    // The page's own scripts and styles (the service worker keeps them once fetched)
    const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s<>\\]+?\.(?:js|css)(?=["'\s\\])/g) ?? [])].slice(0, 80);
    await Promise.all(assets.map((a) => fetch(a).catch(() => null)));
  } catch {}
}

export const downloads = {
  get: load,
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },

  /** Keep a guide for reading offline. */
  async saveGuide(item: ContentItem, href: string) {
    keepFiles();
    const copy: ContentItem = { ...item };
    const text = JSON.stringify(copy);
    save({ ...load().items, [item.id]: { id: item.id, kind: "guide", title: item.title, titleSw: item.titleSw, href, savedAt: new Date().toISOString(), bytes: text.length, status: "ready", item: copy } });
    if (hasCaches() && item.coverImageUrl) {
      try {
        const res = await fetch(item.coverImageUrl, { mode: "no-cors" });
        await (await caches.open(OFFLINE_CACHE)).put(item.coverImageUrl, res);
      } catch {}
    }
    void keepPage(href);
    void keepPage("/me/downloads");
  },

  /** Download a lesson's audio or video. Resolves when it's on the phone; throws if it couldn't. */
  async saveLesson(l: { id: string; title: string; titleSw?: string; href: string; mediaRef: string }) {
    if (!hasCaches()) throw new Error("This browser can't keep files offline.");
    keepFiles();
    setProgress(l.id, 0);
    try {
      const url = await linkFor(l.mediaRef);
      if (!url) throw new Error("no link");
      const res = await fetch(url);
      if (!res.ok || !res.body) throw new Error(`download ${res.status}`);
      const total = Number(res.headers.get("content-length")) || 0;
      const reader = res.body.getReader();
      const parts: Uint8Array[] = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        got += value.length;
        if (total) setProgress(l.id, Math.min(99, Math.round((got / total) * 100)));
      }
      const type = res.headers.get("content-type") || "audio/mpeg";
      const blob = new Blob(parts as BlobPart[], { type });
      await (await caches.open(OFFLINE_CACHE)).put(cacheKey(l.mediaRef), new Response(blob, { headers: { "content-type": type, "content-length": String(blob.size) } }));
      setOfflineUrl(l.mediaRef, URL.createObjectURL(blob));
      save({ ...load().items, [l.id]: { id: l.id, kind: "lesson", title: l.title, titleSw: l.titleSw, href: l.href, savedAt: new Date().toISOString(), bytes: blob.size, status: "ready", mediaRef: l.mediaRef } });
      void keepPage(l.href);
      void keepPage("/me/downloads");
    } finally {
      setProgress(l.id, null);
    }
  },

  async remove(id: string) {
    const d = load().items[id];
    if (!d) return;
    const items = { ...load().items };
    delete items[id];
    save(items);
    if (!hasCaches()) return;
    try {
      const cache = await caches.open(OFFLINE_CACHE);
      if (d.mediaRef) {
        await cache.delete(cacheKey(d.mediaRef));
        setOfflineUrl(d.mediaRef, null);
      }
      if (d.item?.coverImageUrl) await cache.delete(d.item.coverImageUrl);
    } catch {}
  },

  /** A guide's saved copy (for opening it offline when it's no longer in the app's content list). */
  guide(id: string): ContentItem | null {
    const d = load().items[id];
    return d?.kind === "guide" && d.item ? d.item : null;
  },
};

export function useDownloads(): DownloadsState {
  return useSyncExternalStore(downloads.subscribe, downloads.get, () => SERVER);
}

/** Total size on the phone, e.g. "12.4 MB". */
export function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
