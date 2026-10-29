"use client";

// Step 100: the assessment, one question at a time in a pop-up.
// Follow-up questions appear only for what he picked. If he ticks a warning sign, the questions stop
// and his plan screen shows where to get help straight away.

import { useMemo, useState } from "react";
import { Check, ChevronLeft } from "lucide-react";
import Sheet from "@/components/motion/Sheet";
import { useT } from "@/lib/i18n";
import { CERTAINTY_EXPLAINED } from "@/lib/journey/concerns";
import { answered, list, questionsFor, toggleMany, type Question } from "@/lib/journey/questions";
import { blocksPlan, safetyCheck } from "@/lib/journey/safety";
import { journeyStore } from "@/lib/journey/store";
import { say, type Answers } from "@/lib/journey/types";

export default function Assessment({ open, onClose, start }: { open: boolean; onClose: () => void; start?: Answers }) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t("Your assessment")}>
      {/* A fresh form every time it opens (his saved answers are filled in when he redoes it) */}
      {open && <Steps key={String(open)} start={start ?? {}} onDone={onClose} />}
    </Sheet>
  );
}

function Steps({ start, onDone }: { start: Answers; onDone: () => void }) {
  const t = useT();
  const lang = t.lang;
  const [a, setA] = useState<Answers>(start);
  const [i, setI] = useState(0);
  const qs = useMemo(() => questionsFor(a), [a]);
  const q: Question = qs[Math.min(i, qs.length - 1)];
  const v = a[q.id];
  const ok = answered(q, v);
  const last = i >= qs.length - 1;
  const [why, setWhy] = useState(false);

  function finish(answers: Answers) {
    journeyStore.saveAssessment(answers);
    onDone();
  }
  function next() {
    // A warning sign: stop asking and show help now
    if (q.safety && blocksPlan(safetyCheck(a))) return finish(a);
    if (last) return finish(a);
    setI(i + 1);
    setWhy(false);
  }
  function skip() {
    const rest = { ...a };
    delete rest[q.id];
    setA(rest);
    if (last) return finish(rest);
    setI(i + 1);
  }
  const pick = (id: string) => setA({ ...a, [q.id]: q.kind === "many" ? toggleMany(q, v, id) : id });

  const pct = Math.round(((i + 1) / qs.length) * 100);
  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={t("Progress")} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-forest transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[0.6875rem] tabular-nums text-ink-soft">
          {i + 1}/{qs.length}
        </span>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-display text-xl font-extrabold leading-snug">{say(q.title, lang)}</legend>
        {q.help && <p className="mt-1 text-sm text-ink-soft">{say(q.help, lang)}</p>}

        {q.kind === "number" ? (
          <label className="mt-2 flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              aria-label={say(q.title, lang)}
              min={q.min}
              max={q.max}
              value={typeof v === "number" ? v : ""}
              onChange={(e) => setA({ ...a, [q.id]: e.target.value === "" ? undefined : Number(e.target.value) })}
              className="w-32 rounded-2xl bg-surface px-4 py-3 text-lg ring-1 ring-line focus:ring-2 focus:ring-forest focus:outline-none"
            />
            <span className="text-sm text-ink-soft">{q.unit}</span>
          </label>
        ) : (
          <div className="mt-2 flex flex-col gap-2" role={q.kind === "many" ? "group" : "radiogroup"} aria-label={say(q.title, lang)}>
            {(q.options ?? []).map((o) => {
              const on = q.kind === "many" ? list(v).includes(o.id) : v === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  role={q.kind === "many" ? "checkbox" : "radio"}
                  aria-checked={on}
                  onClick={() => pick(o.id)}
                  className={`flex min-h-11 items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition-colors active:scale-[0.99] ${
                    on ? "bg-mint/60 font-semibold text-forest-deep ring-2 ring-forest" : "bg-surface ring-1 ring-line"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center ${q.kind === "many" ? "rounded-md" : "rounded-full"} ${on ? "bg-forest text-white" : "ring-1 ring-line"}`}
                  >
                    {on && <Check size={13} strokeWidth={3} />}
                  </span>
                  {say(o.label, lang)}
                </button>
              );
            })}
          </div>
        )}

        {q.explain === "certainty" && (
          <div className="mt-1">
            <button type="button" onClick={() => setWhy((w) => !w)} aria-expanded={why} className="tap-target text-[0.6875rem] font-medium text-ink-soft underline underline-offset-2">
              {t("What do these mean?")}
            </button>
            {why && (
              <ul className="mt-2 space-y-2 rounded-2xl bg-bg p-3 text-[0.8125rem] ring-1 ring-line">
                {CERTAINTY_EXPLAINED.map((c) => (
                  <li key={c.id}>
                    <span className="font-semibold">{say(c.label, lang)}:</span> {say(c.meaning, lang)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </fieldset>

      <div className="flex items-center gap-2 pt-1">
        {i > 0 && (
          <button type="button" onClick={() => setI(i - 1)} aria-label={t("Back")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface ring-1 ring-line">
            <ChevronLeft size={18} />
          </button>
        )}
        {q.optional && !ok && (
          <button type="button" onClick={skip} className="h-11 flex-1 rounded-full bg-surface text-sm font-semibold ring-1 ring-line">
            {t("Skip")}
          </button>
        )}
        <button
          type="button"
          disabled={!ok}
          onClick={next}
          className="h-11 flex-1 rounded-full bg-forest text-sm font-semibold text-white transition-opacity disabled:opacity-40"
        >
          {last ? t("See my plan") : t("Next")}
        </button>
      </div>
      <p className="text-center text-[0.6875rem] text-ink-soft">{t("Your answers are private. Only you can see them.")}</p>
    </div>
  );
}
