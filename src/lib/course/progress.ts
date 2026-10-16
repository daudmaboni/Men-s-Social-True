// Course progress rules (Step 48). Pure functions, so they're easy to test.
// - Lessons open one after another: finish one, the next opens. Finished lessons stay open.
// - Audio/video: finished when he has HEARD the pass share (70% by default). Skipping ahead doesn't count.
// - Reading: finished when he taps "I've read it".
// - A lesson that isn't ready yet (no audio uploaded) never blocks him: it shows "Coming soon" and is skipped.

import type { CourseProgress } from "../feed/store";
import { flatLessons, lessonReady, type Course, type FlatLesson } from "./types";

export type LessonState = "done" | "current" | "open" | "locked" | "soon";

/** Seconds he must hear before a lesson counts as finished. */
export function passSeconds(seconds: number, passPercent: number): number {
  const pct = Math.min(Math.max(passPercent || 70, 10), 100);
  return Math.ceil((seconds * pct) / 100);
}

export function passReached(heard: number, seconds: number | undefined, passPercent: number): boolean {
  if (!seconds || seconds <= 0) return false;
  return heard >= passSeconds(seconds, passPercent);
}

/**
 * Listening time from one playback step. Normal play (even at 2×) moves a little at a time;
 * a jump (he dragged the slider) adds nothing.
 */
export function heardStep(prevTime: number, nextTime: number, rate = 1): number {
  const d = nextTime - prevTime;
  return d > 0 && d <= 1.5 * Math.max(rate, 1) ? d : 0;
}

export interface CourseView {
  lessons: (FlatLesson & { state: LessonState; progress?: CourseProgress })[];
  /** The lesson to continue with (null when everything ready is finished). */
  current: (FlatLesson & { state: LessonState; progress?: CourseProgress }) | null;
  done: number;
  /** Lessons he can finish today (ready ones). */
  total: number;
  percent: number;
  finished: boolean;
  modules: { id: string; done: number; total: number }[];
}

export function courseView(course: Course, progress: Record<string, CourseProgress> | undefined): CourseView {
  const p = progress ?? {};
  let blocked = false;
  let current: CourseView["current"] = null;
  const lessons = flatLessons(course).map((l) => {
    const prog = p[l.id];
    let state: LessonState;
    if (!lessonReady(l)) state = prog?.done ? "done" : "soon";
    else if (prog?.done) state = "done";
    else if (!blocked) {
      state = "current";
      blocked = true;
    } else state = "locked";
    const out = { ...l, state, progress: prog };
    if (state === "current") current = out;
    return out;
  });
  const ready = lessons.filter((l) => l.state !== "soon");
  const done = ready.filter((l) => l.state === "done").length;
  const modules = course.modules.map((m) => {
    const ls = lessons.filter((l) => l.moduleId === m.id && l.state !== "soon");
    return { id: m.id, done: ls.filter((l) => l.state === "done").length, total: ls.length };
  });
  return {
    lessons,
    current,
    done,
    total: ready.length,
    percent: ready.length ? Math.round((done / ready.length) * 100) : 0,
    finished: ready.length > 0 && done === ready.length,
    modules,
  };
}

/** Can he open this lesson now? */
export const canOpen = (s: LessonState) => s === "done" || s === "current" || s === "open";

/** "4:05" */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}
