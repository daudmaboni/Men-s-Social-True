"use client";

// What a guest sees on Man and Me: a soft, blurred look at what's inside, and a quick way to sign up.
// These tabs hold his personal health records, so they need an account — they're private to him.

import { useState } from "react";
import Link from "next/link";
import { Droplet, Flame, Heart, Lock, MessageCircle, Moon, ShieldCheck, Smile, Sparkles, Stethoscope, Trophy, VenetianMask } from "lucide-react";
import { account, AUTH_METHODS } from "@/lib/account/useAccount";
import { useToast } from "@/components/motion/Toast";
import { useT } from "@/lib/i18n";

const COPY = {
  man: {
    title: "Your daily wellness, in one place",
    text: "Track your water, sleep and mood, do small daily activities, and earn points and badges. Private to you.",
    points: [
      { Icon: Droplet, text: "Water and sleep tracking with simple goals" },
      { Icon: Smile, text: "A 10-second daily check-in on energy and mood" },
      { Icon: Flame, text: "Daily activities, points and a forgiving streak" },
    ],
  },
  community: {
    title: "Talk with other men, privately",
    text: "Ask questions anonymously, reply, and support each other. An account keeps Community safe and free of spam.",
    points: [
      { Icon: VenetianMask, text: "Post anonymously, nobody sees your name" },
      { Icon: MessageCircle, text: "Read real questions and replies from men like you" },
      { Icon: Stethoscope, text: "Ask for an expert answer on health questions" },
    ],
  },
  me: {
    title: "Your progress and settings",
    text: "See your level, badges and goals, and control your privacy and data. Private to you.",
    points: [
      { Icon: Trophy, text: "Levels and 9 badges to earn" },
      { Icon: Sparkles, text: "Your goals and the topics you follow" },
      { Icon: ShieldCheck, text: "Download or delete your data any time" },
    ],
  },
};

/** `community` is shown inside Social (under the Discover / Community switch), so it has no page title. */
export default function LockedTab({ tab }: { tab: "man" | "me" | "community" }) {
  const c = COPY[tab];
  const next = tab === "man" ? "/man" : tab === "me" ? "/me" : "/social?tab=community";
  const showToast = useToast();
  const t = useT();
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-5">
      {tab !== "community" && <h1 className="sr-only">{t(tab === "man" ? "Man" : "Me")}</h1>}

      {/* Blurred example of the real tab */}
      <div className="relative overflow-hidden rounded-[28px]" aria-hidden>
        <div className="pointer-events-none select-none space-y-3 blur-[5px]">
          {tab === "man" ? <ManPreview /> : tab === "me" ? <MePreview /> : <CommunityPreview />}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-bg/10 via-bg/40 to-bg">
          <span className="glass-bar flex h-14 w-14 items-center justify-center rounded-full text-forest-deep">
            <Lock size={22} />
          </span>
        </div>
      </div>

      <div className="rounded-3xl bg-surface p-5 ring-1 ring-line">
        <h2 className="text-xl font-bold leading-snug">{t(c.title)}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t(c.text)}</p>
        <ul className="mt-4 space-y-2.5">
          {c.points.map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint text-forest">
                <Icon size={16} />
              </span>
              {t(text)}
            </li>
          ))}
        </ul>

        <div className="mt-5 space-y-2">
          {AUTH_METHODS.google && (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const r = await account.signInGoogle(next);
                if (r.error) {
                  setBusy(false);
                  showToast(t(r.error));
                }
              }}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-surface py-3.5 text-sm font-semibold ring-1 ring-line transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              <GoogleMark /> {t("Continue with Google")}
            </button>
          )}
          <Link
            href={`/account?next=${next}`}
            className="block w-full rounded-full bg-forest py-3.5 text-center text-sm font-semibold text-white transition-transform active:scale-[0.98]"
          >
            {t("Create free account")}
          </Link>
          <Link href={`/account?mode=login&next=${next}`} className="block w-full py-2 text-center text-sm font-semibold text-forest">
            {t("I have an account · Log in")}
          </Link>
        </div>
      </div>

      <p className="flex items-start gap-2 px-1 text-xs text-ink-soft">
        <Lock size={13} className="mt-0.5 shrink-0 text-forest" />
        {t("Kayani staff can't read your check-ins, and we never use them for adverts. You can keep reading everything in Social without an account.")}
      </p>
    </div>
  );
}

/* Simple look-alikes of the real cards (made-up example values, blurred) */
function ManPreview() {
  return (
    <>
      <div className="rounded-3xl bg-forest-deep p-5 text-white">
        <p className="text-sm text-mint-strong">Good morning</p>
        <p className="mt-1 text-2xl font-bold">3 of 6 done today</p>
        <div className="mt-3 h-2.5 rounded-full bg-white/15">
          <div className="h-full w-1/2 rounded-full bg-mint-strong" />
        </div>
        <p className="mt-3 text-xs text-mint">120 points · Level 2</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-surface p-4 ring-1 ring-line">
          <Droplet size={18} className="text-forest" />
          <p className="mt-2 text-xl font-bold">1.5 L</p>
          <div className="mt-2 h-2 rounded-full bg-line">
            <div className="h-full w-3/5 rounded-full bg-mint-strong" />
          </div>
        </div>
        <div className="rounded-3xl bg-surface p-4 ring-1 ring-line">
          <Moon size={18} className="text-forest" />
          <p className="mt-2 text-xl font-bold">7h 20m</p>
          <div className="mt-2 flex h-8 items-end gap-1">
            {[40, 70, 55, 90, 65, 80, 75].map((h, i) => (
              <span key={i} className="flex-1 rounded-sm bg-mint-strong" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function CommunityPreview() {
  return (
    <>
      {["Is it normal to finish quickly sometimes?", "How do I talk to my wife about this?"].map((q) => (
        <div key={q} className="rounded-3xl bg-surface p-4 ring-1 ring-line">
          <p className="text-xs text-ink-soft">Anonymous · 2h</p>
          <p className="mt-1 font-semibold">{q}</p>
          <p className="mt-3 flex gap-4 text-xs text-ink-soft">
            <span className="flex items-center gap-1"><Heart size={12} /> 12</span>
            <span className="flex items-center gap-1"><MessageCircle size={12} /> 5 replies</span>
          </p>
        </div>
      ))}
    </>
  );
}

function MePreview() {
  return (
    <>
      <div className="rounded-3xl bg-forest-deep p-5 text-white">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-[6px] border-mint-strong text-xl font-bold">3</span>
          <div>
            <p className="text-xl font-bold">Juma</p>
            <p className="text-xs text-mint">245 points · 6 days in a row</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 rounded-3xl bg-surface p-4 ring-1 ring-line">
        {["💧", "🌙", "🔥", "📖", "⭐", "🧭"].map((e) => (
          <span key={e} className="flex h-16 items-center justify-center rounded-2xl bg-mint text-2xl">
            {e}
          </span>
        ))}
      </div>
    </>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
