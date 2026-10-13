"use client";

import { useState } from "react";
import { Flame, Pencil } from "lucide-react";
import CountUp from "@/components/motion/CountUp";
import Sheet from "@/components/motion/Sheet";
import { useToast } from "@/components/motion/Toast";
import { socialStore } from "@/lib/social/store";

/** Top of Me: his name, level ring, points and streak. All from his real activity. */
export default function ProfileHero({
  nickname,
  points,
  level,
  streak,
  since,
}: {
  nickname: string;
  points: number;
  level: { level: number; into: number; toNext: number };
  streak: number;
  since: string | null;
}) {
  const showToast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(nickname);
  const [error, setError] = useState("");

  const R = 34;
  const C = 2 * Math.PI * R;
  const shown = nickname || "Guest";

  function saveName() {
    const n = name.trim();
    if (/\d{6,}|@|https?:/i.test(n)) return setError("Please don't use phone numbers, emails or links.");
    socialStore.setNickname(n);
    setEditing(false);
    showToast(n ? `Hi, ${n}` : "Name removed");
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] bg-forest-deep p-5 text-white">
      <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-forest/60" />
      <div aria-hidden className="absolute -bottom-16 right-16 h-32 w-32 rounded-full bg-mint-strong/10" />

      <div className="relative flex items-center gap-4">
        {/* Level ring */}
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90" role="img" aria-label={`Level ${level.level}, ${level.into} of 100 points to the next level`}>
            <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
            <circle
              cx="40"
              cy="40"
              r={R}
              fill="none"
              stroke="var(--mint-strong)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - level.into / 100)}
              className="transition-[stroke-dashoffset] duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase tracking-wider text-mint">Level</span>
            <span className="text-2xl font-bold leading-none">{level.level}</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <button
            onClick={() => {
              setName(nickname);
              setError("");
              setEditing(true);
            }}
            className="flex max-w-full items-center gap-1.5 text-left"
          >
            <span className="truncate text-2xl font-bold">{shown}</span>
            <Pencil size={14} className="shrink-0 text-mint" aria-label="Change name" />
          </button>
          <p className="mt-0.5 text-xs text-mint">
            {since ? `With Men's Social since ${formatSince(since)}` : "Welcome. Your journey starts today."}
          </p>
          <p className="mt-2 text-xs text-mint/90">
            {level.toNext} points to level {level.level + 1}
          </p>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/10 p-3">
          <p className="text-2xl font-bold">
            <CountUp to={points} />
          </p>
          <p className="text-xs text-mint">points</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3">
          <p className="flex items-center gap-1 text-2xl font-bold">
            <Flame size={20} className={streak > 0 ? "text-mint-strong" : "text-white/40"} />
            {streak}
          </p>
          <p className="text-xs text-mint">{streak === 1 ? "day in a row" : "days in a row"}</p>
        </div>
      </div>

      <Sheet open={editing} onClose={() => setEditing(false)} title="What should we call you?">
        <p className="text-xs text-ink-soft">
          A first name or nickname is enough. It&apos;s also your name in Community, unless you post anonymously.
        </p>
        <input
          autoFocus
          value={name}
          maxLength={24}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && saveName()}
          placeholder="e.g. Juma"
          className="mt-3 w-full rounded-2xl bg-bg px-4 py-3 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-forest"
        />
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
        <button onClick={saveName} className="mt-4 w-full rounded-full bg-forest py-3 text-sm font-semibold text-white">
          Save
        </button>
      </Sheet>
    </section>
  );
}

function formatSince(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
