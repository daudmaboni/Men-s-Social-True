"use client";

// Published courses for the Man tab: remembered on the phone so the course card opens instantly
// (and offline), refreshed when the app comes back to the front. Hidden lessons are removed here.

import { useEffect, useSyncExternalStore } from "react";
import { listLiveCourses } from "./repo";
import { visibleCourse, type Course } from "./types";

const KEY = "ms_courses_v1";
type State = { courses: Course[]; ready: boolean };
const SERVER: State = { courses: [], ready: false };
let current: State | null = null;
let lastFetch = 0;
const listeners = new Set<() => void>();

function read(): State {
  if (current) return current;
  try {
    const raw = localStorage.getItem(KEY);
    current = raw ? { courses: (JSON.parse(raw) as Course[]).map(visibleCourse), ready: true } : { courses: [], ready: false };
  } catch {
    current = { courses: [], ready: false };
  }
  return current;
}

let inFlight: Promise<void> | null = null;
/** Every screen with a course card asks on open; they share one request (Step 58). */
function refresh(force = false): Promise<void> {
  if (inFlight) return inFlight;
  if (!force && Date.now() - lastFetch < 30_000) return Promise.resolve();
  inFlight = fetchCourses().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function fetchCourses() {
  lastFetch = Date.now();
  try {
    const live = await listLiveCourses();
    try {
      localStorage.setItem(KEY, JSON.stringify(live));
    } catch {}
    current = { courses: live.map(visibleCourse), ready: true };
  } catch {
    // Offline or not set up yet: keep what we have
    current = { ...read(), ready: true };
  }
  listeners.forEach((l) => l());
}

export function useCourses(): State {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => SERVER,
  );
  useEffect(() => {
    void refresh(true);
    const onFocus = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  return state;
}

/** The course on the Man tab (one for now: the first published). */
export function useMainCourse(): { course: Course | null; ready: boolean } {
  const { courses, ready } = useCourses();
  return { course: courses[0] ?? null, ready };
}

/** Pick the language's version of a text. */
export const pick = (sw: boolean, en?: string, swText?: string) => (sw && swText ? swText : en ?? swText ?? "");
