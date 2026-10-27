"use client";

// One audio player for the whole app (Step 49). It lives outside any page, so a lesson keeps playing
// when he switches tabs or opens another page; the mini player shows it, and the lesson page controls it.
// It also does the listening rules (Step 48, counted by heard parts since Step 98): only real listening counts, the lesson is finished at
// the pass share, and where he stopped is saved (on all his phones through his account).
// When a lesson ends, the countdown to the next lesson runs here, so it works wherever he is.

import { useSyncExternalStore } from "react";
import { feedStore } from "../feed/store";
import { passReached } from "./progress";
import { addPart, heardSeconds, isListening, partsFromOld, type HeardParts } from "./heard";
import { linkFor, playable } from "./media";

export interface PlayerLesson {
  id: string;
  number: number;
  title: string;
  mediaUrl: string;
  seconds?: number;
  passPercent: number;
  points: number;
  done: boolean;
}

export interface PlayerState {
  lesson: PlayerLesson | null;
  playing: boolean;
  time: number;
  duration: number;
  /** Which parts of the lesson he has heard (Step 98). */
  parts: HeardParts;
  speed: number;
  failed: boolean;
  ended: boolean;
  /** "Next lesson in 10…": which lesson comes next and when the count ends (ms timestamp). */
  countdown: { nextId: string; endsAt: number } | null;
}

export const COUNTDOWN_MS = 10_000;

const EMPTY: PlayerState = { lesson: null, playing: false, time: 0, duration: 0, parts: [], speed: 1, failed: false, ended: false, countdown: null };
let state: PlayerState = EMPTY;
const listeners = new Set<() => void>();
let el: HTMLAudioElement | null = null;
let prev = 0;
/** Real time (ms) of the last position report while playing: a step the clock can't explain is a jump. */
let lastWall = 0;
const wallNow = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
/** Where to start once the file has loaded (the browser ignores a jump before that). */
let pendingStart = 0;
/** Resolves when the current lesson's file address is in the player (private files need a link first, Step 59). */
let sourceReady: Promise<void> = Promise.resolve();
let lastSave = 0;
let countdownTimer: ReturnType<typeof setTimeout> | null = null;

/** Hooks the app sets up once (CoursePlayerHost): what to do when a lesson finishes or ends. */
export const playerHooks: {
  /** He reached the pass share: say so (points, next lesson open). */
  onFinish?: (l: PlayerLesson) => void;
  /** The audio played to the end: the host decides whether a countdown starts. */
  onEnded?: (l: PlayerLesson) => void;
  /** The countdown reached 0. */
  onCountdownDone?: (nextId: string, fromId: string) => void;
} = {};

function set(patch: Partial<PlayerState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function audio(): HTMLAudioElement {
  if (el) return el;
  el = new Audio();
  el.preload = "metadata";
  el.addEventListener("loadedmetadata", () => {
    if (!el) return;
    const len = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : state.lesson?.seconds ?? 0;
    if (pendingStart > 0 && pendingStart < len - 5) {
      el.currentTime = pendingStart;
      prev = pendingStart;
    }
    pendingStart = 0;
    set({ duration: len, time: el.currentTime });
  });
  el.addEventListener("timeupdate", onTime);
  el.addEventListener("play", () => {
    prev = el?.currentTime ?? prev;
    lastWall = wallNow();
    set({ playing: true, ended: false, failed: false });
  });
  el.addEventListener("pause", () => {
    set({ playing: false });
    save();
  });
  el.addEventListener("ended", () => {
    set({ playing: false, ended: true });
    save(true);
    if (state.lesson) playerHooks.onEnded?.(state.lesson);
  });
  // Any jump (slider, ±15, lock-screen buttons): start counting again from the new place
  const reset = () => {
    prev = el?.currentTime ?? 0;
    lastWall = wallNow();
  };
  el.addEventListener("seeking", reset);
  el.addEventListener("seeked", reset);
  el.addEventListener("error", () => set({ failed: true, playing: false }));
  // Save when the app goes to the background
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && save());
  return el;
}

function save(atEnd = false, quiet = false) {
  const l = state.lesson;
  if (!l || !el) return;
  feedStore.saveCourseSpot(l.id, atEnd ? 0 : el.currentTime, state.parts, quiet);
  lastSave = Date.now();
}

function onTime() {
  if (!el || !state.lesson) return;
  const pos = el.currentTime;
  const t = wallNow();
  // Real listening: he moved forward about as much as the clock and speed explain. This also counts
  // while the screen is locked, when the phone reports the place only every few seconds (Step 98).
  const listened = !el.seeking && isListening(prev, pos, (t - lastWall) / 1000, el.playbackRate);
  let parts = state.parts;
  if (listened) {
    parts = addPart(parts, prev, pos);
    const len = state.duration || el.duration || 0;
    const l = state.lesson;
    if (!l.done && passReached(heardSeconds(parts, len), len, l.passPercent)) {
      const done = { ...l, done: true };
      set({ lesson: done, parts });
      feedStore.saveCourseSpot(l.id, pos, parts);
      feedStore.finishCourseLesson(l.id, l.points);
      playerHooks.onFinish?.(done);
    }
  }
  prev = pos;
  lastWall = t;
  set({ time: pos, parts });
  // Every few seconds while playing: kept on the phone only (a full save happens on pause / leaving)
  if (Date.now() - lastSave > 5000) save(false, true);
}

function mediaSession(l: PlayerLesson, label: string) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
  // Discreet on the lock screen: never the lesson title
  navigator.mediaSession.metadata = new MediaMetadata({ title: label.replace("{n}", String(l.number)), artist: "Men's Social" });
  navigator.mediaSession.setActionHandler("play", () => void coursePlayer.play());
  navigator.mediaSession.setActionHandler("pause", () => coursePlayer.pause());
  navigator.mediaSession.setActionHandler("seekbackward", () => coursePlayer.skip(-15));
  navigator.mediaSession.setActionHandler("seekforward", () => coursePlayer.skip(15));
}

export const coursePlayer = {
  get: () => state,

  /** Put a lesson in the player (starting where he stopped). Plays straight away when `autoplay`. */
  load(l: PlayerLesson, from: { pos?: number; heard?: number; parts?: HeardParts }, opts: { autoplay?: boolean; lockLabel?: string } = {}) {
    const a = audio();
    this.cancelCountdown();
    if (state.lesson?.id !== l.id) {
      if (state.lesson) save();
      const now = playable(l.mediaUrl);
      if (now) {
        a.src = now;
        sourceReady = Promise.resolve();
      } else {
        // A private file whose link isn't on the phone yet: stop the old one and fetch the link
        a.pause();
        a.removeAttribute("src");
        sourceReady = linkFor(l.mediaUrl).then((url) => {
          if (state.lesson?.id !== l.id) return;
          if (url) a.src = url;
          else set({ failed: true });
        });
      }
      a.playbackRate = state.speed;
      const pos = from.pos ?? 0;
      const len = l.seconds ?? 0;
      const start = pos > 0 && (!len || pos < len - 5) ? pos : 0;
      pendingStart = start;
      prev = start;
      lastWall = wallNow();
      set({ lesson: l, time: start, duration: len, parts: partsFromOld(from.heard, from.parts), failed: false, ended: false, playing: false });
      mediaSession(l, opts.lockLabel ?? "Lesson {n}");
    } else {
      set({ lesson: { ...state.lesson, ...l, done: state.lesson.done || l.done } });
    }
    if (opts.autoplay) void this.play();
  },

  async play() {
    if (!state.lesson) return;
    const a = audio();
    if (state.ended) {
      a.currentTime = 0;
      prev = 0;
      lastWall = wallNow();
    }
    this.cancelCountdown();
    try {
      await sourceReady;
      if (!a.getAttribute("src")) throw new Error("no file");
      await a.play();
    } catch {
      set({ failed: true });
    }
  },
  pause() {
    el?.pause();
  },
  toggle() {
    if (state.playing) this.pause();
    else void this.play();
  },
  /** Jump (dragging or ±15 s). Jumps never count as listening. */
  seek(to: number) {
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(to, (el.duration || state.duration || to) - 0.5));
    prev = el.currentTime;
    lastWall = wallNow();
    set({ time: el.currentTime, ended: false });
  },
  skip(by: number) {
    this.seek((el?.currentTime ?? state.time) + by);
  },
  setSpeed(speed: number) {
    if (el) el.playbackRate = speed;
    set({ speed });
  },
  /** Stop and close the mini player (his place is saved). */
  stop() {
    this.cancelCountdown();
    if (el) {
      save();
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    set({ ...EMPTY, speed: state.speed });
  },

  startCountdown(nextId: string) {
    this.cancelCountdown();
    const from = state.lesson?.id ?? "";
    set({ countdown: { nextId, endsAt: Date.now() + COUNTDOWN_MS } });
    countdownTimer = setTimeout(() => {
      countdownTimer = null;
      const c = state.countdown;
      set({ countdown: null });
      if (c) playerHooks.onCountdownDone?.(c.nextId, from);
    }, COUNTDOWN_MS);
  },
  /** He tapped Cancel: stay on the lesson he just finished. */
  cancelCountdown() {
    if (countdownTimer) clearTimeout(countdownTimer);
    countdownTimer = null;
    if (state.countdown) set({ countdown: null });
  },
};

/** Is the Man-tab course card on screen right now? Then the mini player isn't needed (it has the controls). */
let cardOnScreen = false;
const cardListeners = new Set<() => void>();
export function setCourseCardOnScreen(v: boolean) {
  if (cardOnScreen === v) return;
  cardOnScreen = v;
  cardListeners.forEach((l) => l());
}
export function useCourseCardOnScreen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      cardListeners.add(cb);
      return () => cardListeners.delete(cb);
    },
    () => cardOnScreen,
    () => false,
  );
}

/** Just one piece of the player state: the component re-renders only when that piece changes
 *  (not 4 times a second while a lesson plays). */
export function useCoursePlayerSelect<T>(pick: (s: PlayerState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => pick(state),
    () => pick(EMPTY),
  );
}

export function useCoursePlayer(): PlayerState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => EMPTY,
  );
}
