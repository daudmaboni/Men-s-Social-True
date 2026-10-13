"use client";

// The language he chose on the welcome screen (or later on Me). Saved on the phone as "ms_lang".

import { useSyncExternalStore } from "react";

export type Lang = "en" | "sw";
const KEY = "ms_lang";
const listeners = new Set<() => void>();

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
  listeners.forEach((l) => l());
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
