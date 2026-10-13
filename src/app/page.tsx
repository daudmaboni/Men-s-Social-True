"use client";

import { useState } from "react";

type Lang = "en" | "sw";

const copy = {
  en: {
    tagline: "Your private companion for men's wellness",
    points: [
      "Daily activities that fit your life",
      "Short lessons from trusted sources",
      "A private space to track how you feel",
    ],
    ageQuestion: "This app talks openly about men's sexual health.",
    confirm: "I am 18 or older",
    privacy: "No sign-up needed to look around. Your data stays private.",
    welcome: "Welcome in. The home feed is coming next.",
  },
  sw: {
    tagline: "Mwenzako wa siri kwa afya ya mwanaume",
    points: [
      "Shughuli za kila siku zinazoendana na maisha yako",
      "Masomo mafupi kutoka vyanzo vya kuaminika",
      "Sehemu ya siri ya kufuatilia unavyojisikia",
    ],
    ageQuestion: "Programu hii inazungumzia afya ya uzazi ya mwanaume kwa uwazi.",
    confirm: "Nina miaka 18 au zaidi",
    privacy: "Huhitaji kujisajili ili kuangalia. Taarifa zako ni siri.",
    welcome: "Karibu. Ukurasa wa nyumbani unakuja hivi karibuni.",
  },
} as const;

export default function Welcome() {
  const [lang, setLang] = useState<Lang>("en");
  const [entered, setEntered] = useState(false);
  const t = copy[lang];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-6">
      {/* Top bar: logo + language switch */}
      <header className="rise flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-sm font-bold text-mint">
            MS
          </div>
          <span className="text-base font-semibold">Men&apos;s Social</span>
        </div>
        <div className="flex rounded-full bg-surface p-1 text-xs font-semibold ring-1 ring-line">
          {(["en", "sw"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                lang === l ? "bg-forest text-white" : "text-ink-soft"
              }`}
              aria-pressed={lang === l}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {/* Hero card */}
      <section className="rise rise-2 mt-8 rounded-3xl bg-forest-deep p-6 text-white">
        <p className="text-sm text-mint-strong">Kayani Men&apos;s Social</p>
        <h1 className="mt-2 text-[28px] font-bold leading-tight">{t.tagline}</h1>
        <ul className="mt-6 space-y-3">
          {t.points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-sm text-mint">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-mint-strong" />
              {p}
            </li>
          ))}
        </ul>
      </section>

      {/* Age check */}
      <section className="rise rise-3 mt-4 rounded-3xl bg-surface p-5 ring-1 ring-line">
        {entered ? (
          <p className="text-center text-sm font-medium text-forest">{t.welcome}</p>
        ) : (
          <>
            <p className="text-sm text-ink-soft">{t.ageQuestion}</p>
            <button
              onClick={() => setEntered(true)}
              className="mt-4 w-full rounded-full bg-forest py-3.5 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
            >
              {t.confirm}
            </button>
          </>
        )}
      </section>

      <p className="rise rise-4 mt-auto pt-8 text-center text-xs text-ink-soft">{t.privacy}</p>
    </main>
  );
}
