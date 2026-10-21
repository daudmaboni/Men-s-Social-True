"use client";

import { useCallback, useRef, useState } from "react";
import { Check, ChevronDown, Clock, Undo2 } from "lucide-react";
import { useFoldOnLeave } from "@/components/motion/FoldCard";
import { Why } from "./FeedCards";
import { useToast } from "@/components/motion/Toast";
import { feedStore } from "@/lib/feed/store";
import type { Activity } from "@/lib/feed/catalog";
import type { HomeFeed } from "./useHomeFeed";
import { useT } from "@/lib/i18n";

export default function ActivitiesCard({ f }: { f: HomeFeed }) {
  const showToast = useToast();
  const t = useT();
  const [burst, setBurst] = useState<{
    id: string;
    points: number;
    key: number;
  } | null>(null);

  function done(a: Activity) {
    touch(a.id);
    feedStore.setChoice(a.id, "done");
    setBurst({ id: a.id, points: a.points, key: Date.now() });
    setTimeout(() => setBurst(null), 950);
    showToast(f.isNew ? t("Nice! Your points are saved on this phone.") : t("+{n} points", { n: a.points }));
  }

  // Check-in, water and sleep have their own cards on this screen, so only show the rest here
  const list = f.activities.filter((a) => !a.tracker);
  const listDone = list.filter((a) => f.statuses[a.id] === "done").length;

  // Step 51: only the next 2 to do are shown; the rest unfold on "Show all" and fold again when he
  // scrolls away. (Something he just ticked stays in view until the card folds, so Undo is at hand.)
  const SHOW = 2;
  const [open, setOpen] = useState(false);
  const [instant, setInstant] = useState(false);
  const [touched, setTouched] = useState<string[]>([]);
  const box = useRef<HTMLElement>(null);
  const fold = useCallback(() => {
    setInstant(true);
    setOpen(false);
    setTouched([]);
  }, []);
  useFoldOnLeave(box, open || touched.length > 0, fold);
  const isOpen = (a: Activity) => {
    const s = f.statuses[a.id];
    return s !== "done" && s !== "skipped";
  };
  const next = [...list.filter((a) => isOpen(a) && f.statuses[a.id] !== "later"), ...list.filter((a) => f.statuses[a.id] === "later")];
  const first = new Set([...touched, ...next.slice(0, SHOW).map((a) => a.id)]);
  const shown = list.filter((a) => first.has(a.id));
  const rest = list.filter((a) => !first.has(a.id));
  const touch = (id: string) => setTouched((x) => (x.includes(id) ? x : [...x, id]));

  return (
    <section ref={box} className="rounded-3xl bg-surface p-5 ring-1 ring-line">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{t("Today's activities")}</p>
        <span className="text-xs text-ink-soft">{t("{done} of {total} done", { done: listDone, total: list.length })}</span>
      </div>

      {next.length === 0 && (
        <p className="mt-3 rounded-2xl bg-mint/50 px-4 py-3 text-sm font-semibold text-forest">{t("All done for today. Well done.")}</p>
      )}
      <ul className="mt-3 divide-y divide-line">{shown.map((a) => row(a))}</ul>

      {rest.length > 0 && (
        <>
          <div className="expand" data-open={open} data-instant={instant} inert={!open}>
            <div>
              <ul className="fold-body divide-y divide-line border-t border-line">{rest.map((a) => row(a))}</ul>
            </div>
          </div>
          <button
            onClick={() => {
              setInstant(false);
              setOpen(!open);
            }}
            aria-expanded={open}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-semibold text-forest ring-1 ring-line"
          >
            {open ? t("Show less") : t("Show all {n} activities", { n: list.length })}
            <ChevronDown size={14} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
        </>
      )}
    </section>
  );

  function row(a: Activity) {
    const s = f.statuses[a.id];
    const title = f.discreet ? a.discreetTitle : a.title;
    const closed = s === "done" || s === "skipped";
    return (
      <li key={a.id} className="relative py-3">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
              s === "done" ? "bg-forest text-white" : s === "later" ? "bg-mint text-forest" : "ring-1 ring-line"
            }`}
          >
            {s === "done" ? <Check size={14} strokeWidth={3} /> : s === "later" ? <Clock size={12} /> : null}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium ${closed ? "text-ink-soft line-through decoration-line" : ""}`}>{t(title)}</p>
            <p className="text-[0.6875rem] text-ink-soft">
              {s === "skipped"
                ? t("Skipped today")
                : s === "later"
                  ? t("Saved for later today")
                  : `${t(a.detail)} · ${t("+{n} points", { n: a.points })}`}
            </p>

            {/* Actions */}
            {!closed && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  onClick={() => done(a)}
                  className="rounded-full bg-forest px-3.5 py-1.5 text-xs font-semibold text-white transition-transform active:scale-95"
                >
                  {t("Done")}
                </button>
                {s !== "later" && (
                  <button
                    onClick={() => {
                      touch(a.id);
                      feedStore.setChoice(a.id, "later");
                      showToast(t("Saved for later today"));
                    }}
                    className="rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ring-line"
                  >
                    {t("Later")}
                  </button>
                )}
                <button
                  onClick={() => {
                    touch(a.id);
                    feedStore.setChoice(a.id, "skipped");
                    showToast(t("Skipped. No problem."));
                  }}
                  className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink-soft"
                >
                  {t("Skip")}
                </button>
              </div>
            )}
            {closed && (
              <button
                onClick={() => feedStore.clearChoice(a.id)}
                className="mt-1 flex items-center gap-1 text-[0.6875rem] font-semibold text-forest"
              >
                <Undo2 size={11} /> {t("Undo")}
              </button>
            )}
            {!closed && <Why text={a.why} />}
          </div>
        </div>

        {burst?.id === a.id && (
          <span
            key={burst.key}
            className="float-up absolute right-2 top-2 rounded-full bg-forest-deep px-2.5 py-1 text-xs font-bold text-white"
          >
            +{burst.points}
          </span>
        )}
      </li>
    );
  }
}
