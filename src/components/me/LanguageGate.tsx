"use client";

// The first time a man opens the app on a phone, he picks his language before seeing any content,
// so nobody lands on English, doesn't understand, and leaves. Shown once; he can change it later on Me.

import { setLang, useLangChosen } from "@/lib/me/lang";
import BrandMark from "@/components/brand/BrandMark";

export default function LanguageGate() {
  const chosen = useLangChosen();
  if (chosen) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="lang-gate-h" className="fixed inset-0 z-[100] flex flex-col bg-forest-deep text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-12">
        <BrandMark />
        <h1 id="lang-gate-h" className="mt-10 font-display text-[32px] font-bold leading-tight">
          Chagua lugha
          <span className="mt-1 block text-[20px] font-semibold text-mint">Choose your language</span>
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/75">
          Utaweza kubadilisha baadaye kwenye Mimi.
          <span className="block">You can change it later on Me.</span>
        </p>
        <div className="mt-8 space-y-3">
          <button
            lang="sw"
            onClick={() => setLang("sw")}
            className="flex w-full items-center justify-between rounded-3xl bg-white px-6 py-5 text-left text-forest-deep transition-transform active:scale-[0.98]"
          >
            <span>
              <span className="block text-xl font-bold">Kiswahili</span>
              <span className="block text-sm text-ink-soft">Endelea kwa Kiswahili</span>
            </span>
            <span aria-hidden className="text-2xl">🇹🇿</span>
          </button>
          <button
            lang="en"
            onClick={() => setLang("en")}
            className="flex w-full items-center justify-between rounded-3xl bg-white/10 px-6 py-5 text-left ring-1 ring-white/25 transition-transform active:scale-[0.98]"
          >
            <span>
              <span className="block text-xl font-bold">English</span>
              <span className="block text-sm text-white/70">Continue in English</span>
            </span>
            <span aria-hidden className="text-2xl">🇬🇧</span>
          </button>
        </div>
      </div>
    </div>
  );
}
