"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { account, accountLabel, useAccount } from "@/lib/account/useAccount";
import { stopSync } from "@/lib/account/sync";

type Lang = "en" | "sw";

const copy = {
  en: {
    tagline: "Your private companion for men's wellness",
    points: [
      "Daily activities that fit your life",
      "Short lessons from trusted sources",
      "A private space to track how you feel",
    ],
    ageQuestion: "This app talks openly about men's sexual health. By continuing you confirm you are 18 or older.",
    start: "Get started",
    create: "Create free account",
    login: "I have an account · Log in",
    continue: "Continue",
    signedInAs: "Signed in as",
    notYou: "Not you?",
    privacy: "No sign-up needed to look around. Your data stays private.",
  },
  sw: {
    tagline: "Mwenzako wa siri kwa afya ya mwanaume",
    points: [
      "Shughuli za kila siku zinazoendana na maisha yako",
      "Masomo mafupi kutoka vyanzo vya kuaminika",
      "Sehemu ya siri ya kufuatilia unavyojisikia",
    ],
    ageQuestion: "Programu hii inazungumzia afya ya uzazi ya mwanaume kwa uwazi. Kwa kuendelea unathibitisha una miaka 18 au zaidi.",
    start: "Anza sasa",
    create: "Fungua akaunti bure",
    login: "Nina akaunti · Ingia",
    continue: "Endelea",
    signedInAs: "Umeingia kama",
    notYou: "Si wewe?",
    privacy: "Huhitaji kujisajili ili kuangalia. Taarifa zako ni siri.",
  },
} as const;

export default function Welcome() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const t = copy[lang];

  // This page always stays here (no automatic redirect). If he's already signed in,
  // the buttons change to "Continue" so he isn't asked to log in again.
  const acc = useAccount();

  // Remember the language he picked last time
  useEffect(() => {
    try {
      if (localStorage.getItem("ms_lang") === "sw") setLang("sw");
    } catch {}
  }, []);

  /** Every choice confirms 18+ and saves the language, then goes in as a guest or to the account screen. */
  function enter(to: string) {
    try {
      localStorage.setItem("ms_age_ok", "1");
      localStorage.setItem("ms_lang", lang);
    } catch {}
    router.push(to);
  }

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

      {/* Age check + three ways in */}
      <section className="rise rise-3 mt-4 rounded-3xl bg-surface p-5 ring-1 ring-line">
        <p className="text-sm text-ink-soft">{t.ageQuestion}</p>
        {acc.status === "signedIn" ? (
          <>
            <button
              onClick={() => enter("/social")}
              className="mt-4 w-full rounded-full bg-forest py-3.5 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
            >
              {t.continue}
            </button>
            <p className="mt-3 text-center text-xs text-ink-soft">
              {t.signedInAs} {accountLabel(acc.user)} ·{" "}
              <button
                onClick={async () => {
                  // Another man on this phone: remove the signed-in man's data from it, then sign out
                  stopSync({ clearPhone: true });
                  await account.signOut();
                }}
                className="font-semibold text-forest"
              >
                {t.notYou}
              </button>
            </p>
          </>
        ) : (
          <>
            <button
              onClick={() => enter("/social")}
              className="mt-4 w-full rounded-full bg-forest py-3.5 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
            >
              {t.start}
            </button>
            <button
              onClick={() => enter("/account?next=/social")}
              className="mt-2 w-full rounded-full bg-mint py-3.5 text-sm font-semibold text-forest-deep transition-transform active:scale-[0.98]"
            >
              {t.create}
            </button>
            <button
              onClick={() => enter("/account?mode=login&next=/social")}
              className="mt-2 w-full py-2.5 text-sm font-semibold text-forest"
            >
              {t.login}
            </button>
          </>
        )}
      </section>

      <p className="rise rise-4 mt-auto pt-8 text-center text-xs text-ink-soft">{t.privacy}</p>
    </main>
  );
}
