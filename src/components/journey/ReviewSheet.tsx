"use client";

// Step 100: the two-weekly review. "How is it going?" for each area he chose, and an easy way to make
// the plan smaller when life is busy. Getting worse (or no change twice) brings up "see a professional"
// on his plan — never blame.

import { useState } from "react";
import Sheet from "@/components/motion/Sheet";
import { useT } from "@/lib/i18n";
import { concernById } from "@/lib/journey/concerns";
import { journeyStore } from "@/lib/journey/store";
import { say, type ConcernId, type ReviewAnswer } from "@/lib/journey/types";

const CHOICES: { id: ReviewAnswer; label: string }[] = [
  { id: "better", label: "Better" },
  { id: "same", label: "The same" },
  { id: "worse", label: "Worse" },
  { id: "unsure", label: "Not sure" },
];

export default function ReviewSheet({
  open,
  onClose,
  focus,
  quiet,
  smaller,
}: {
  open: boolean;
  onClose: () => void;
  focus: ConcernId[];
  /** He was active on only a few days: offer a smaller plan. */
  quiet: boolean;
  smaller: boolean;
}) {
  const t = useT();
  const [answers, setAnswers] = useState<Partial<Record<ConcernId | "overall", ReviewAnswer>>>({});
  const [small, setSmall] = useState(smaller);
  const rows: (ConcernId | "overall")[] = focus.length ? focus : ["overall"];

  function save() {
    journeyStore.saveReview(answers);
    if (small !== smaller) journeyStore.setSmaller(small);
    setAnswers({});
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("How is it going?")}>
      <div className="flex flex-col gap-5 pb-2">
        <p className="text-sm text-ink-soft">{t("Two weeks in. Tell us honestly, there's no wrong answer.")}</p>
        {rows.map((id) => {
          const name = id === "overall" ? t("Overall") : say(concernById(id)!.name, t.lang);
          return (
            <fieldset key={id}>
              <legend className="text-sm font-semibold">{name}</legend>
              <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label={name}>
                {CHOICES.map((c) => {
                  const on = answers[id] === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setAnswers({ ...answers, [id]: c.id })}
                      className={`min-h-11 rounded-2xl px-3 text-sm ${on ? "bg-mint/60 font-semibold text-forest-deep ring-2 ring-forest" : "bg-surface ring-1 ring-line"}`}
                    >
                      {t(c.label)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
        {(quiet || smaller) && (
          <label className="flex min-h-11 items-center gap-3 rounded-2xl bg-bg px-4 py-3 text-sm ring-1 ring-line">
            <input type="checkbox" checked={small} onChange={(e) => setSmall(e.target.checked)} className="h-5 w-5 accent-[var(--color-forest)]" />
            <span>{quiet ? t("Life gets busy. Make my plan smaller for now (2 things a day).") : t("Keep my plan small (2 things a day)")}</span>
          </label>
        )}
        <button
          type="button"
          onClick={save}
          disabled={rows.some((r) => !answers[r])}
          className="h-11 rounded-full bg-forest text-sm font-semibold text-white disabled:opacity-40"
        >
          {t("Save")}
        </button>
      </div>
    </Sheet>
  );
}
