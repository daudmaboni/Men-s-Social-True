"use client";

import { reactionCount, REACTIONS, type ReactionKind } from "@/lib/social/community";
import { socialStore, useSocial } from "@/lib/social/store";

export default function ReactionBar({
  targetId,
  base,
  compact = false,
}: {
  targetId: string;
  base?: Partial<Record<ReactionKind, number>>;
  compact?: boolean;
}) {
  const { reactions } = useSocial();
  const mine = reactions[targetId];
  return (
    <div className="flex flex-wrap gap-1.5">
      {REACTIONS.map((r) => {
        const on = Boolean(mine?.includes(r.kind));
        const n = reactionCount(base, mine, r.kind);
        return (
          <button
            key={r.kind}
            aria-pressed={on}
            aria-label={`${r.label}${n ? `, ${n}` : ""}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              socialStore.react(targetId, r.kind);
            }}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95 ${
              on ? "bg-mint text-forest-deep ring-1 ring-mint-strong" : "text-ink-soft ring-1 ring-line"
            }`}
          >
            <span aria-hidden="true">{r.emoji}</span>
            {!compact && <span>{r.label}</span>}
            {n > 0 && <span className="tabular-nums">{n}</span>}
          </button>
        );
      })}
    </div>
  );
}
