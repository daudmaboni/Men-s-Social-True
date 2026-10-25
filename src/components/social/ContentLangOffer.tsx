"use client";

// Step 94: a small floating card on Discover asking if he'd rather read the content in English.
// Content is Kiswahili by default. Rules live in lib/me/contentLang.ts (first visit, then once a day,
// 3 days at most, never again after "Usionyeshe tena" or once he has chosen).
// Written in both languages on purpose: he may not read English yet.
// Step 96: it used the points "float-up" animation, which ends invisible and untappable; now it slides in and stays.

import { useEffect, useState } from "react";
import { Globe, X } from "lucide-react";
import { useToast } from "@/components/motion/Toast";
import { dateKey } from "@/lib/progress/dates";
import { currentContentLang, markOfferShown, neverOffer, readOffer, setContentLang, shouldOffer } from "@/lib/me/contentLang";

/** Wait a moment after Discover opens, so he sees the content first. */
const DELAY_MS = 2500;

export default function ContentLangOffer() {
  const [open, setOpen] = useState(false);
  const showToast = useToast();

  useEffect(() => {
    const today = dateKey(new Date());
    if (!shouldOffer(readOffer(), today, currentContentLang())) return;
    const timer = setTimeout(() => {
      // Check again: he may have changed it on another screen meanwhile
      if (!shouldOffer(readOffer(), today, currentContentLang())) return;
      markOfferShown(today);
      setOpen(true);
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!open) return null;

  const english = () => {
    setContentLang("en");
    setOpen(false);
    showToast("English on. Switch back to Kiswahili anytime on Me → Settings.");
  };
  const never = () => {
    neverOffer();
    setOpen(false);
    showToast("Sawa, tutaendelea kwa Kiswahili.");
  };

  return (
    <div
      role="dialog"
      aria-labelledby="content-lang-h"
      className="mini-in fixed left-3 z-30 w-[min(20rem,calc(100%-88px))] rounded-3xl bg-forest-deep p-4 text-white shadow-2xl ring-1 ring-white/10 bottom-[calc(max(12px,env(safe-area-inset-bottom))+88px)] lg:bottom-6 lg:left-auto lg:right-48"
    >
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Funga · Close"
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-white/80 active:scale-95"
      >
        <X size={16} aria-hidden />
      </button>
      <p id="content-lang-h" className="flex items-start gap-2 pr-10">
        <Globe size={18} className="mt-0.5 shrink-0 text-mint" aria-hidden />
        <span>
          <span className="block text-[0.9375rem] font-bold leading-snug">Ungependa kusoma kwa Kiingereza?</span>
          <span lang="en" className="block text-xs text-white/70">Prefer to read in English?</span>
        </span>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          lang="en"
          onClick={english}
          className="min-h-11 rounded-full bg-white px-4 py-2 text-sm font-bold text-forest-deep transition-transform active:scale-95"
        >
          English
        </button>
        <button type="button" onClick={never} className="min-h-11 rounded-full px-3 py-2 text-xs font-semibold text-white/80 ring-1 ring-white/25 transition-transform active:scale-95">
          Usionyeshe tena
        </button>
      </div>
    </div>
  );
}
