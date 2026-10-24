"use client";

// Step 94: the language of the CONTENT (cards, guides, reels, stories on Discover), separate from the
// app's words (buttons, menus, tab names), which still follow ms_lang.
// Content is Kiswahili by default, because most men arriving read Kiswahili. Saved as "ms_content_lang".
//
// The "Read in English?" offer: shown on his first visit, then at most once a day, on 3 different days
// in total. If he hasn't switched by then, it never shows again. "Don't show again" ends it straight away.
// Once he picks a content language himself (offer or Me → Settings), it never shows again either.

import { useSyncExternalStore } from "react";
import type { Lang } from "./lang";

const KEY = "ms_content_lang";
const OFFER_KEY = "ms_content_lang_offer";
/** How many different days the offer can appear. */
export const OFFER_DAYS = 3;

const listeners = new Set<() => void>();
const ping = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "sw";
  } catch {
    return "sw";
  }
}

/** Content language right now (for code outside React screens). */
export const currentContentLang = (): Lang => read();

/** He picked it himself (the offer or Settings), so the offer is finished for good. */
export function setContentLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {}
  saveOffer({ ...readOffer(), never: true });
  ping();
}

/** The content language: "sw" unless he chose English. */
export function useContentLang(): Lang {
  return useSyncExternalStore(subscribe, read, () => "sw");
}

/** true when content should show in Kiswahili. */
export const useContentSw = () => useContentLang() === "sw";

/* ───────── The "Read in English?" offer ───────── */

export interface OfferState {
  /** The days ("2026-10-24") it was shown. */
  days: string[];
  /** Never show it again. */
  never?: boolean;
}

/** Pure rule (tested): should the offer appear today? */
export function shouldOffer(s: OfferState, today: string, lang: Lang): boolean {
  if (lang !== "sw" || s.never) return false; // already English, or finished
  if (s.days.includes(today)) return false; // once a day
  return s.days.length < OFFER_DAYS;
}

/** Record that it was shown today. */
export function withShown(s: OfferState, today: string): OfferState {
  return s.days.includes(today) ? s : { ...s, days: [...s.days, today] };
}

export function readOffer(): OfferState {
  try {
    const raw = localStorage.getItem(OFFER_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<OfferState>) : {};
    return { days: Array.isArray(v.days) ? v.days.filter((d) => typeof d === "string") : [], never: v.never === true };
  } catch {
    return { days: [], never: true }; // storage blocked: don't nag
  }
}

function saveOffer(s: OfferState) {
  try {
    localStorage.setItem(OFFER_KEY, JSON.stringify(s));
  } catch {}
}

export const markOfferShown = (today: string) => saveOffer(withShown(readOffer(), today));
export const neverOffer = () => saveOffer({ ...readOffer(), never: true });
