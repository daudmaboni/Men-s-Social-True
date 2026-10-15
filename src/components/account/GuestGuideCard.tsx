"use client";

// At the end of a guide, a guest sees a soft invite: he has just got value, so this is a good
// moment to show what an account adds. It never blocks reading — he can scroll past it.

import Link from "next/link";
import { Bell, Flame, MessageCircle, ShieldCheck } from "lucide-react";
import { useAccount } from "@/lib/account/useAccount";
import { useT } from "@/lib/i18n";

const PERKS = [
  { Icon: Flame, text: "Daily activities, points and progress tracking" },
  { Icon: Bell, text: "Private reminders that fit your day" },
  { Icon: MessageCircle, text: "Ask questions in the Community, anonymously" },
];

export default function GuestGuideCard({ next }: { next: string }) {
  const acc = useAccount();
  const t = useT();
  if (acc.status !== "guest") return null;
  const back = encodeURIComponent(next);

  return (
    <section className="rounded-3xl bg-forest-deep p-5 text-white" aria-labelledby="guest-guide-title">
      <h2 id="guest-guide-title" className="text-lg font-bold leading-snug">
        {t("Found this useful? There's more inside.")}
      </h2>
      <p className="mt-1 text-sm text-mint">{t("Create a free account to put what you read into practice.")}</p>
      <ul className="mt-4 space-y-2.5">
        {PERKS.map(({ Icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-sm">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-mint-strong">
              <Icon size={16} />
            </span>
            {t(text)}
          </li>
        ))}
      </ul>
      <Link
        href={`/account?mode=signup&next=${back}`}
        className="mt-5 block w-full rounded-full bg-mint py-3.5 text-center text-sm font-semibold text-forest-deep transition-transform active:scale-[0.98]"
      >
        {t("Create free account")}
      </Link>
      <Link href={`/account?mode=login&next=${back}`} className="mt-1 block w-full py-2 text-center text-sm font-semibold text-mint">
        {t("I have an account · Log in")}
      </Link>
      <p className="mt-1 flex items-start gap-2 text-xs text-mint/80">
        <ShieldCheck size={13} className="mt-0.5 shrink-0" />
        {t("Use a nickname if you like. Nobody sees your name or your records.")}
      </p>
    </section>
  );
}
