"use client";

// Step 92: every video keeps its own shape.
// A wide video (16:9) shows wide, an upright one (9:16) shows upright, and anything in between
// (4:5, square) shows as it was filmed. The app reads the shape from the video itself the first
// time it loads, and remembers it on this phone so the box is the right size straight away next time.
// YouTube tells us nothing before it plays, so Shorts are upright and other YouTube links are wide.

import { useCallback, useEffect, useState } from "react";
import { isYouTube, isYouTubeShort } from "../content/youtube";

export const UPRIGHT = 9 / 16;
export const WIDE = 16 / 9;

const KEY = "ms_video_shape";
const MAX_KEPT = 300;
const known = new Map<string, number>();
const listeners = new Set<() => void>();
let loaded = false;

const valid = (r: unknown): r is number => typeof r === "number" && Number.isFinite(r) && r > 0.2 && r < 5;

/** The same file with or without "#t=0.5" is the same video. */
export const shapeKey = (url: string) => url.split("#")[0];

/** Width ÷ height, or null when the video hasn't said yet. */
export function ratioFrom(width: number, height: number): number | null {
  if (!(width > 0 && height > 0)) return null;
  const r = width / height;
  return valid(r) ? Math.round(r * 1000) / 1000 : null;
}

/** The shape before the video has loaded: what we remember, YouTube's kind, or the fallback. */
export function shapeOf(url: string | null | undefined, fallback: number): number {
  if (!url) return fallback;
  if (isYouTube(url)) return isYouTubeShort(url) ? UPRIGHT : WIDE;
  return known.get(shapeKey(url)) ?? fallback;
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, unknown>)) if (valid(v)) known.set(k, v);
  } catch {}
}

function persist() {
  try {
    const entries = [...known].slice(-MAX_KEPT);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}

/** Remember a video's real shape (from its width and height). */
export function rememberShape(url: string | null | undefined, width: number, height: number) {
  if (!url || isYouTube(url)) return;
  const r = ratioFrom(width, height);
  if (r === null) return;
  load();
  const k = shapeKey(url);
  if (known.get(k) === r) return;
  known.delete(k); // newest last, so the oldest drop off first
  known.set(k, r);
  persist();
  listeners.forEach((l) => l());
}

/**
 * The shape of one video.
 *   const shape = useVideoShape(url, UPRIGHT);
 *   <div style={{ aspectRatio: shape.ratio }}>  <video onLoadedMetadata={shape.measure} … />
 * `fallback` is used until the video has loaded once (reels: UPRIGHT, other videos: WIDE).
 */
export function useVideoShape(url: string | null | undefined, fallback: number = WIDE) {
  const [, bump] = useState(0);
  useEffect(() => {
    load();
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    l(); // pick up what this phone already remembers (after the first paint, so server and phone agree)
    return () => {
      listeners.delete(l);
    };
  }, []);

  const ratio = shapeOf(url, fallback);
  const measure = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const v = e.currentTarget;
      rememberShape(url, v.videoWidth, v.videoHeight);
    },
    [url],
  );

  return { ratio, upright: ratio < 1, wide: ratio > 1, measure };
}
