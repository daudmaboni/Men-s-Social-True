"use client";

// The language he chose on the welcome screen (or later on Me). Saved on the phone as "ms_lang".

import { useSyncExternalStore } from "react";

export type Lang = "en" | "sw";
const KEY = "ms_lang";
const listeners = new Set<() => void>();

/** The language right now (for code outside React screens). */
export const currentLang = (): Lang => read();

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === "sw" ? "sw" : "en";
  } catch {
    return "en";
  }
}

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {}
  if (typeof document !== "undefined") document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

/** Has he ever picked a language on this phone? (Until he does, the app asks before showing content.) */
function chosen(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return true; // storage blocked: don't keep asking
  }
}

export function useLangChosen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    chosen,
    () => true,
  );
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "en",
  );
}
