"use client";

// Studio: the hooks on a "do this" card (Step 86), used by the Card maker and the Content editor.
//  - Question first: a question (tap for the answer) or a true/false he guesses before the answer shows.
//  - Series: name + part number. The next part opens for a man the day after he does this one.
//  - Challenge: "Try it 3/5/7 days" under the card.
//  - Safe share title: the plain line that goes with the link on WhatsApp (nothing private on a lock screen).

import { useMemo } from "react";
import { Segmented, input } from "@/components/admin/ui";
import { useLibrary } from "@/lib/content/useLibrary";
import { actionOf } from "@/lib/content/actions";
import { CHALLENGE_DAYS, seriesId } from "@/lib/content/action-shape";
import { SAFE_SHARE } from "@/lib/content/hooks";
import type { ActionSpec, CardAsk, CardSeries, ChallengeDays } from "@/lib/content/types";

type Known = { id: string; name: string; nameSw: string; parts: { part: number; id: string }[] };

/** Every series already on Discover (published cards), for the name list and "parts so far". */
export function useKnownSeries(): Known[] {
  const { items } = useLibrary();
  return useMemo(() => {
    const m = new Map<string, Known>();
    for (const it of items) {
      const s = actionOf(it)?.series;
      if (!s) continue;
      const k = m.get(s.id) ?? { id: s.id, name: s.name, nameSw: s.nameSw, parts: [] };
      k.parts.push({ part: s.part, id: it.id });
      m.set(s.id, k);
    }
    return [...m.values()].map((k) => ({ ...k, parts: k.parts.sort((a, b) => a.part - b.part) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);
}

export default function HookFields({ spec, cardId, onChange }: { spec: ActionSpec; cardId: string; onChange: (patch: Partial<ActionSpec>) => void }) {
  const known = useKnownSeries();
  const ask = spec.ask;
  const series = spec.series;
  const setAsk = (patch: Partial<CardAsk>) => onChange({ ask: { kind: "question", q: "", qSw: "", a: "", aSw: "", ...ask, ...patch } });
  const setSeries = (patch: Partial<CardSeries>) => {
    const next = { id: "", name: "", nameSw: "", part: 1, ...series, ...patch };
    onChange({ series: { ...next, id: seriesId(next.name || next.nameSw) || next.id } });
  };
  const same = series ? known.find((k) => k.id === series.id) : undefined;
  const taken = same?.parts.filter((p) => p.id !== cardId).map((p) => p.part) ?? [];

  return (
    <div className="space-y-5">
      {/* Question first */}
      <div className="space-y-2 text-sm">
        <p className="font-semibold">Start with a question</p>
        <p className="text-xs text-ink-soft">The first slide asks something; he taps to see the answer, then swipes to the steps. Curiosity makes men stop scrolling.</p>
        <Segmented
          label="Question first"
          value={ask ? ask.kind : "none"}
          onChange={(v) => (v === "none" ? onChange({ ask: undefined }) : setAsk({ kind: v, ...(v === "truefalse" ? { truth: ask?.truth ?? false } : {}) }))}
          options={[
            { id: "none", label: "No" },
            { id: "question", label: "Question" },
            { id: "truefalse", label: "True or false" },
          ]}
        />
        {ask && (
          <div className="space-y-2 rounded-2xl p-3 ring-1 ring-line">
            <Pair label={ask.kind === "truefalse" ? "The statement (e.g. “Beetroot makes you stronger in bed”)" : "The question (e.g. “Why do most men finish in 2 minutes?”)"} en={ask.q} sw={ask.qSw} onChange={(q, qSw) => setAsk({ q, qSw })} />
            {ask.kind === "truefalse" && (
              <Segmented
                label="Is it true?"
                value={ask.truth ? "yes" : "no"}
                onChange={(v) => setAsk({ truth: v === "yes" })}
                options={[
                  { id: "yes", label: "True" },
                  { id: "no", label: "Myth" },
                ]}
              />
            )}
            <Pair label={ask.kind === "truefalse" ? "The explanation he sees after guessing" : "The answer"} en={ask.a} sw={ask.aSw} onChange={(a, aSw) => setAsk({ a, aSw })} long />
          </div>
        )}
      </div>

      {/* Series */}
      <div className="space-y-2 text-sm">
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={Boolean(series)} onChange={(e) => onChange({ series: e.target.checked ? { id: "", name: "", nameSw: "", part: (taken.length ? Math.max(...taken) : 0) + 1 } : undefined })} />
          Part of a series
        </label>
        <p className="text-xs text-ink-soft">Like “5 nights to last longer”. Part 1 is always on Discover; each next part opens for a man the day after he does the one before (Studio → Discover can change that).</p>
        {series && (
          <div className="space-y-2 rounded-2xl p-3 ring-1 ring-line">
            <datalist id="known-series">
              {known.map((k) => (
                <option key={k.id} value={k.name} />
              ))}
            </datalist>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_90px]">
              <input
                className={input}
                list="known-series"
                value={series.name}
                placeholder="Series name (English)"
                aria-label="Series name (English)"
                onChange={(e) => {
                  const k = known.find((x) => x.name === e.target.value);
                  setSeries(k ? { name: k.name, nameSw: k.nameSw, part: Math.max(0, ...k.parts.filter((p) => p.id !== cardId).map((p) => p.part)) + 1 } : { name: e.target.value });
                }}
              />
              <input className={input} lang="sw" value={series.nameSw} placeholder="Jina (Kiswahili)" aria-label="Series name (Kiswahili)" onChange={(e) => setSeries({ nameSw: e.target.value })} />
              <input
                className={input}
                type="number"
                min={1}
                max={30}
                value={series.part}
                aria-label="Part number"
                onChange={(e) => setSeries({ part: Math.min(30, Math.max(1, Number(e.target.value) || 1)) })}
              />
            </div>
            {same && (
              <p className={`text-xs ${taken.includes(series.part) ? "font-semibold text-red-600" : "text-ink-soft"}`}>
                Parts already live: {taken.join(", ") || "none"}.{taken.includes(series.part) ? ` Part ${series.part} is taken: men would see only the newest one.` : ""}
              </p>
            )}
            <Pair
              label="One line about the next part (shown at the end of this one)"
              en={series.tease ?? ""}
              sw={series.teaseSw ?? ""}
              onChange={(tease, teaseSw) => setSeries({ tease: tease || undefined, teaseSw: teaseSw || undefined })}
            />
          </div>
        )}
      </div>

      {/* Challenge */}
      <div className="space-y-2 text-sm">
        <p className="font-semibold">Challenge</p>
        <p className="text-xs text-ink-soft">Adds “Try it N days” under the card. Each day it sits at the top of his Discover; he earns points per day and a badge when he finishes. Missed days never fail him.</p>
        <Segmented
          label="Challenge"
          value={spec.challengeDays ? String(spec.challengeDays) : "none"}
          onChange={(v) => onChange({ challengeDays: v === "none" ? undefined : (Number(v) as ChallengeDays) })}
          options={[{ id: "none", label: "None" }, ...CHALLENGE_DAYS.map((d) => ({ id: String(d), label: `${d} days` }))]}
        />
      </div>

      {/* Share title */}
      <div className="text-sm">
        <Pair
          label="Safe title for WhatsApp (optional)"
          en={spec.shareTitle ?? ""}
          sw={spec.shareTitleSw ?? ""}
          onChange={(shareTitle, shareTitleSw) => onChange({ shareTitle: shareTitle || undefined, shareTitleSw: shareTitleSw || undefined })}
          placeholders={[SAFE_SHARE.en, SAFE_SHARE.sw]}
        />
        <p className="mt-1 text-xs text-ink-soft">This line goes with the link when a man sends the card to a friend. Keep it plain: it may show on the friend&apos;s lock screen.</p>
      </div>
    </div>
  );
}

function Pair({ label, en, sw, onChange, long = false, placeholders = ["English", "Kiswahili"] }: { label?: string; en: string; sw: string; onChange: (en: string, sw: string) => void; long?: boolean; placeholders?: [string, string] }) {
  const F = long ? "textarea" : "input";
  return (
    <div className="text-sm">
      {label && <p className="mb-1 text-xs font-semibold text-ink-soft">{label}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <F className={`${input} ${long ? "min-h-[64px]" : ""}`} value={en} onChange={(e) => onChange(e.target.value, sw)} aria-label={`${label ?? "Text"} (English)`} placeholder={placeholders[0]} />
        <F className={`${input} ${long ? "min-h-[64px]" : ""}`} value={sw} onChange={(e) => onChange(en, e.target.value)} aria-label={`${label ?? "Text"} (Kiswahili)`} placeholder={placeholders[1]} lang="sw" />
      </div>
    </div>
  );
}
