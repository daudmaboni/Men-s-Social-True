"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import Sheet from "@/components/motion/Sheet";
import type { Badge } from "@/lib/me/badges";

export default function BadgesSection({ badges }: { badges: Badge[] }) {
  const [open, setOpen] = useState<Badge | null>(null);
  const earned = badges.filter((b) => b.earned).length;

  return (
    <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">Badges</h2>
        <p className="text-xs text-ink-soft">
          {earned} of {badges.length} earned
        </p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {badges.map((b) => (
          <button
            key={b.id}
            onClick={() => setOpen(b)}
            className={`flex flex-col items-center rounded-2xl p-3 text-center transition-transform active:scale-95 ${
              b.earned ? "bg-mint" : "bg-bg ring-1 ring-line"
            }`}
          >
            <span className={`relative text-3xl ${b.earned ? "" : "opacity-35 grayscale"}`} aria-hidden>
              {b.emoji}
              {!b.earned && (
                <Lock size={12} className="absolute -bottom-0.5 -right-2 rounded-full bg-surface p-0.5 text-ink-soft" />
              )}
            </span>
            <span className={`mt-1.5 text-[11px] font-semibold leading-tight ${b.earned ? "text-forest-deep" : "text-ink-soft"}`}>
              {b.title}
            </span>
            {!b.earned && (
              <span className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden>
                <span className="block h-full rounded-full bg-mint-strong" style={{ width: `${(b.current / b.target) * 100}%` }} />
              </span>
            )}
          </button>
        ))}
      </div>

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open ? `${open.emoji}  ${open.title}` : ""}>
        {open && (
          <div className="space-y-3">
            <p className="text-xs italic text-ink-soft">{open.titleSw}</p>
            <p className="text-sm">{open.how}</p>
            <div>
              <div className="h-2.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-forest" style={{ width: `${(open.current / open.target) * 100}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-ink-soft">
                {open.earned ? "Earned. Well done." : `${open.current} of ${open.target}`}
              </p>
            </div>
            <button onClick={() => setOpen(null)} className="w-full rounded-full bg-forest py-3 text-sm font-semibold text-white">
              {open.earned ? "Nice" : "Let's do it"}
            </button>
          </div>
        )}
      </Sheet>
    </section>
  );
}
