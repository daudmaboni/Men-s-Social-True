"use client";

import { reactionCount, REACTIONS, type ReactionKind } from "@/lib/social/community";
import { useCommunity } from "./useCommunity";
import { useT } from "@/lib/i18n";

export default function ReactionBar({
  targetId,
  base,
  compact = false,
}: {
  targetId: string;
  base?: Partial<Record<ReactionKind, number>>;
  compact?: boolean;
}) {
  const c = useCommunity();
  const mine = c.myReactions[targetId];
  const t = useT();
  return (
    <div className="flex flex-wrap gap-1.5">
      {REACTIONS.map((r) => {
        const on = Boolean(mine?.includes(r.kind));
        const n = reactionCount(base, mine, r.kind);
        return (
          <button
            key={r.kind}
            aria-pressed={on}
            aria-label={`${t(r.label)}${n ? `, ${n}` : ""}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void c.react(targetId, r.kind);
            }}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95 ${
              on ? "bg-mint text-forest-deep ring-1 ring-mint-strong" : "text-ink-soft ring-1 ring-line"
            }`}
          >
            <span aria-hidden="true">{r.emoji}</span>
            {!compact && <span>{t(r.label)}</span>}
            {n > 0 && <span className="tabular-nums">{n}</span>}
          </button>
        );
      })}
    </div>
  );
}
