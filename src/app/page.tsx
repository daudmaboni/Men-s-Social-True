"use client";

import { useRouter } from "next/navigation";
import { account, accountLabel, useAccount } from "@/lib/account/useAccount";
import { stopSync } from "@/lib/account/sync";
import { setLang, useLang } from "@/lib/me/lang";
import { NIPATE_NINI_IDS } from "@/lib/content/nipate-nini";
import { ChevronRight, HeartPulse, Leaf, Salad, Sprout, Target, type LucideIcon } from "lucide-react";

/** "Nipate Nini?" — what he gets from the app. Each card opens its guide. */
const OFFERS: { id: string; Icon: LucideIcon; en: [string, string]; sw: [string, string] }[] = [
  {
    id: NIPATE_NINI_IDS.lifestyle,
    Icon: HeartPulse,
    en: ["Lifestyle changes", "Sleep, movement and stress habits that build your strength"],
    sw: ["Mabadiliko ya mtindo wa maisha", "Tabia za usingizi, mazoezi na msongo zinazojenga nguvu zako"],
  },
  {
    id: NIPATE_NINI_IDS.food,
    Icon: Salad,
    en: ["Food that helps", "What to eat and avoid for blood flow and energy"],
    sw: ["Chakula kinachosaidia", "Ule nini na uepuke nini kwa mzunguko wa damu na nguvu"],
  },
  {
    id: NIPATE_NINI_IDS.quit,
    Icon: Target,
    en: ["Quit masturbation", "A private, step-by-step plan — without guilt"],
    sw: ["Acha punyeto", "Mpango wa siri, hatua kwa hatua — bila kujilaumu"],
  },
  {
    id: NIPATE_NINI_IDS.herbs,
    Icon: Leaf,
    en: ["Herbs men use for ED", "What each herb is, how it's used and what's known"],
    sw: ["Mitishamba ya nguvu za kiume", "Kila mmea ni nini, unavyotumika na kinachojulikana"],
  },
  {
    id: NIPATE_NINI_IDS.plants,
    Icon: Sprout,
    en: ["Tanzanian plants", "Mlonge, tangawizi, kitunguu saumu and more — how to use them"],
    sw: ["Mimea ya Tanzania", "Mlonge, tangawizi, kitunguu saumu na mingine — jinsi ya kuitumia"],
  },
];

const copy = {
  en: {
    tagline: "Your private companion for men's wellness",
    points: [
      "Daily activities that fit your life",
      "Short lessons from trusted sources",
      "A private space to track how you feel",
    ],
    ageQuestion: "This app talks openly about men's sexual health. By continuing you confirm you are 18 or older.",
    create: "Create free account",
    guest: "Enter as guest",
    guestNote: "No sign-up needed · read all guides, videos and quizzes",
    login: "I have an account · Log in",
    continue: "Continue",
    signedInAs: "Signed in as",
    notYou: "Not you?",
    privacy: "No sign-up needed to look around. Your data stays private.",
    offersTitle: "What do I get?",
    offersNote: "Free guides. Tap one to read — no sign-up needed.",
  },
  sw: {
    tagline: "Mwenzako wa siri kwa afya ya mwanaume",
    points: [
      "Shughuli za kila siku zinazoendana na maisha yako",
      "Masomo mafupi kutoka vyanzo vya kuaminika",
      "Sehemu ya siri ya kufuatilia unavyojisikia",
    ],
    ageQuestion: "Programu hii inazungumzia afya ya uzazi ya mwanaume kwa uwazi. Kwa kuendelea unathibitisha una miaka 18 au zaidi.",
    create: "Fungua akaunti bure",
    guest: "Ingia kama mgeni",
    guestNote: "Huhitaji kujisajili · soma miongozo, video na maswali yote",
    login: "Nina akaunti · Ingia",
    continue: "Endelea",
    signedInAs: "Umeingia kama",
    notYou: "Si wewe?",
    privacy: "Huhitaji kujisajili ili kuangalia. Taarifa zako ni siri.",
    offersTitle: "Nipate Nini?",
    offersNote: "Miongozo ya bure. Gusa mmoja usome — huhitaji kujisajili.",
  },
} as const;

export default function Welcome() {
  const router = useRouter();
  // The same language setting as the rest of the app (Me → Language), so a choice here carries everywhere
  const lang = useLang();
  const t = copy[lang];

  // This page always stays here (no automatic redirect). If he's already signed in,
  // the buttons change to "Continue" so he isn't asked to log in again.
  const acc = useAccount();

  /** Every choice confirms 18+ and saves the language, then goes in as a guest or to the account screen. */
  function enter(to: string) {
    try {
      localStorage.setItem("ms_age_ok", "1");
    } catch {}
    router.push(to);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-6 lg:max-w-5xl lg:px-10 lg:pt-8">
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

      {/* On a computer: the hero on the left, the way in on the right */}
      {/* Phone and computer: the content sits in the middle of the screen (my-auto) */}
      <div className="my-auto py-6 lg:grid lg:grid-cols-[1.25fr_1fr] lg:items-stretch lg:gap-6 lg:py-10">
      {/* Hero card */}
      <section className="rise rise-2 rounded-3xl bg-forest-deep p-6 text-white lg:mt-0 lg:flex lg:flex-col lg:justify-center lg:p-12">
        <p className="text-sm text-mint-strong">Kayani Men&apos;s Social</p>
        <h1 className="mt-2 text-[28px] font-bold leading-tight lg:text-[44px]">{t.tagline}</h1>
        <ul className="mt-6 space-y-3 lg:mt-8 lg:space-y-4">
          {t.points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-sm text-mint lg:text-base">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-mint-strong" />
              {p}
            </li>
          ))}
        </ul>
      </section>

      {/* Age check + three ways in */}
      <section className="rise rise-3 mt-4 rounded-3xl bg-surface p-5 ring-1 ring-line lg:mt-0 lg:flex lg:flex-col lg:justify-center lg:p-8">
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
            {/* Guests can read everything on Discover; Man, Me and Community ask for an account */}
            <button
              onClick={() => enter("/account?mode=signup&next=/man")}
              className="mt-4 w-full rounded-full bg-forest py-3.5 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
            >
              {t.create}
            </button>
            <button
              onClick={() => enter("/social")}
              className="mt-2 w-full rounded-full bg-mint py-3 text-forest-deep transition-transform active:scale-[0.98]"
            >
              <span className="block text-sm font-semibold">{t.guest}</span>
              <span className="block text-[11px] text-forest">{t.guestNote}</span>
            </button>
            <button
              onClick={() => enter("/account?mode=login&next=/man")}
              className="mt-2 w-full py-2.5 text-sm font-semibold text-forest-deep"
            >
              {t.login}
            </button>
          </>
        )}
      </section>

      </div>

      {/* Nipate Nini? — what he gets. Opening a guide also confirms 18+ (the note above says so). */}
      <section className="rise rise-4 pb-4" aria-labelledby="offers-title">
        <h2 id="offers-title" className="text-xl font-bold lg:text-2xl">
          {t.offersTitle}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{t.offersNote}</p>
        <ul className="mt-3 grid gap-2 lg:mt-4 lg:grid-cols-5 lg:gap-3">
          {OFFERS.map(({ id, Icon, ...o }) => {
            const [title, line] = o[lang];
            return (
              <li key={id}>
                <button
                  onClick={() => enter(`/social/c/${id}`)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-surface p-3.5 text-left ring-1 ring-line transition-transform active:scale-[0.98] lg:h-full lg:flex-col lg:items-start lg:p-5"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mint text-forest-deep">
                    <Icon size={22} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="mt-0.5 block text-xs text-ink-soft">{line}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-ink-soft lg:hidden" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="rise rise-4 pt-2 text-center text-xs text-ink-soft">{t.privacy}</p>
    </main>
  );
}
