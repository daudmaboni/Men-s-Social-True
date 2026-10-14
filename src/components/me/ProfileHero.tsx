"use client";

import { useState } from "react";
import { Flame, Pencil } from "lucide-react";
import CountUp from "@/components/motion/CountUp";
import { useT } from "@/lib/i18n";
import type { Profile } from "@/lib/me/profile";
import Avatar from "./Avatar";
import EditProfileSheet from "./EditProfileSheet";

/** Top of Me: his photo inside the level ring, name, points and streak. All from his real activity. */
export default function ProfileHero({
  nickname,
  profile,
  account,
  points,
  level,
  streak,
  since,
}: {
  nickname: string;
  profile: Profile;
  /** His login (email or phone) when signed in */
  account: string | null;
  points: number;
  level: { level: number; into: number; toNext: number };
  streak: number;
  since: string | null;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);

  const R = 37;
  const C = 2 * Math.PI * R;
  const shown = nickname || t("Add your name");
  const details = [profile.ageRange, profile.region === "Outside Tanzania" ? t("Outside Tanzania") : profile.region].filter(Boolean).join(" · ");

  return (
    <section className="relative overflow-hidden rounded-[28px] bg-forest-deep p-5 text-white">
      <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-forest/60" />
      <div aria-hidden className="absolute -bottom-16 right-16 h-32 w-32 rounded-full bg-mint-strong/10" />

      <div className="relative flex items-center gap-4">
        {/* Photo inside the level ring */}
        <button
          onClick={() => setEditing(true)}
          className="relative h-[88px] w-[88px] shrink-0 rounded-full"
          aria-label={t("Edit profile")}
        >
          <svg viewBox="0 0 88 88" className="absolute inset-0 h-full w-full -rotate-90" role="img" aria-label={t("Level {level}, {into} of 100 points to the next level", { level: level.level, into: level.into })}>
            <circle cx="44" cy="44" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
            <circle
              cx="44"
              cy="44"
              r={R}
              fill="none"
              stroke="var(--mint-strong)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - level.into / 100)}
              className="transition-[stroke-dashoffset] duration-1000 ease-out"
            />
          </svg>
          {/* Centred inside the ring: the wrapper is positioned, the photo fills it */}
          <span className="absolute inset-[11px] block">
            <Avatar name={nickname} photo={profile.photo} className="h-full w-full text-xl" />
          </span>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-mint-strong px-2 py-0.5 text-[10px] font-bold text-forest-deep">
            {t("Level {n}", { n: level.level })}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <button onClick={() => setEditing(true)} className="flex max-w-full items-center gap-1.5 text-left">
            <span className={`truncate text-2xl font-bold ${nickname ? "" : "text-white/70"}`}>{shown}</span>
            <Pencil size={14} className="shrink-0 text-mint" aria-hidden />
          </button>
          {details && <p className="mt-0.5 truncate text-xs text-white/80">{details}</p>}
          <p className="mt-0.5 text-xs text-mint">
            {since ? t("With Men's Social since {date}", { date: formatSince(since, t.locale) }) : t("Welcome. Your journey starts today.")}
          </p>
          <p className="mt-2 text-xs text-mint/90">{t("{n} points to level {level}", { n: level.toNext, level: level.level + 1 })}</p>
          <button
            onClick={() => setEditing(true)}
            className="mt-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-white/20"
          >
            {t("Edit profile")}
          </button>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/10 p-3">
          <p className="text-2xl font-bold">
            <CountUp to={points} />
          </p>
          <p className="text-xs text-mint">{t("points")}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3">
          <p className="flex items-center gap-1 text-2xl font-bold">
            <Flame size={20} className={streak > 0 ? "text-mint-strong" : "text-white/40"} />
            {streak}
          </p>
          <p className="text-xs text-mint">{t(streak === 1 ? "day in a row" : "days in a row")}</p>
        </div>
      </div>

      <EditProfileSheet open={editing} onClose={() => setEditing(false)} name={nickname} profile={profile} account={account} />
    </section>
  );
}

function formatSince(key: string, locale: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}
