"use client";

// Studio → Analytics → "What pulls men back" (Step 86): per card, over the last 30 days, counted without who
// (admin_hook_stats, migration 0019): hearts ("This helped"), WhatsApp/other shares, challenges started and
// finished, and how far men get in each series.

import { useMemo } from "react";
import { Panel, Stat, useLoad } from "./ui";
import { RankBars } from "./Chart";
import { rpc } from "@/lib/admin/api";
import { useLibrary } from "@/lib/content/useLibrary";
import { actionOf } from "@/lib/content/actions";
import { seriesOf } from "@/lib/content/hooks";

type Row = { content_id: string; views: number; completes: number; saves: number; hearts: number; shares: number; challenge_starts: number; challenge_finishes: number; helped_yes: number; helped_some: number; helped_no: number };

export default function HookStats() {
  const r = useLoad(() => rpc<Row[]>("admin_hook_stats", { p_days: 30 }), []);
  const { items } = useLibrary();
  const title = useMemo(() => new Map(items.map((i) => [i.id, i.title])), [items]);
  const series = useMemo(() => [...seriesOf(items.flatMap((item) => (actionOf(item) ? [{ item, spec: actionOf(item)! }] : []))).values()], [items]);
  if (r.loading) return null;
  if (r.error || !r.data) {
    return (
      <Panel title="What pulls men back" sub="Needs migration 0019">
        <p className="text-sm text-ink-soft">Run supabase/migrations/0019_discover_hooks.sql in Supabase (SQL Editor) to see hearts, shares and challenges.</p>
      </Panel>
    );
  }
  const rows = r.data;
  const sum = (k: keyof Row) => rows.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const by = new Map(rows.map((x) => [x.content_id, x]));
  const top = (k: keyof Row) =>
    rows
      .filter((x) => Number(x[k]) > 0)
      .sort((a, b) => Number(b[k]) - Number(a[k]))
      .slice(0, 8)
      .map((x) => ({ label: title.get(x.content_id) ?? x.content_id, n: Number(x[k]) }));
  const starts = sum("challenge_starts");
  const finishes = sum("challenge_finishes");

  return (
    <Panel title="What pulls men back" sub="Last 30 days, counted without who. Hearts = men who said a card helped; shares = sent to a friend.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Hearts" value={sum("hearts")} />
        <Stat label="Shared to a friend" value={sum("shares")} />
        <Stat label="Challenges started" value={starts} />
        <Stat label="Challenges finished" value={finishes} hint={starts ? `${Math.round((finishes / starts) * 100)}% of starts` : undefined} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-sm font-semibold">Most hearts</p>
          {top("hearts").length ? <RankBars rows={top("hearts")} unit="hearts" /> : <p className="text-xs text-ink-soft">No hearts yet.</p>}
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">Most shared</p>
          {top("shares").length ? <RankBars rows={top("shares")} unit="shares" /> : <p className="text-xs text-ink-soft">Nothing shared yet.</p>}
        </div>
      </div>
      {series.length > 0 && (
        <div className="mt-6">
          <p className="mb-1 text-sm font-semibold">How far men get in each series</p>
          <p className="mb-3 text-xs text-ink-soft">Men who tapped “I did it” on each part. A big drop between two parts shows where they lose interest.</p>
          <div className="space-y-4">
            {series.map((s) => (
              <div key={s.id}>
                <p className="text-xs font-bold">{s.name}</p>
                <RankBars rows={s.parts.map((p) => ({ label: `Part ${p.spec.series!.part}: ${p.item.title}`, n: by.get(p.item.id)?.completes ?? 0 }))} unit="men" />
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
