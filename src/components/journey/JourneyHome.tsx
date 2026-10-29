"use client";

// Step 100: My Journey — the first thing he sees on Jamii (Social). It answers four questions on one screen:
// where am I, what's the one thing to do next, what else today, and how am I doing.
// Before the assessment there is no plan, only the way in. Warning signs always come first.

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, ChevronDown, ExternalLink, HeartHandshake, Stethoscope } from "lucide-react";
import { useToast } from "@/components/motion/Toast";
import { haptic } from "@/lib/motion/haptics";
import { useT, type T } from "@/lib/i18n";
import { feedStore } from "@/lib/feed/store";
import { concernById } from "@/lib/journey/concerns";
import { STAGE_LABEL, type Plan, type Primary } from "@/lib/journey/engine";
import { journeyStore } from "@/lib/journey/store";
import type { TaskDef } from "@/lib/journey/tasks";
import { restrictions } from "@/lib/journey/safety";
import { say, type Answers, type Restriction, type SafetyNote } from "@/lib/journey/types";
import { useJourneyPlan } from "./useJourneyPlan";
import Assessment from "./Assessment";
import ReviewSheet from "./ReviewSheet";

export default function JourneyHome() {
  const t = useT();
  const { ready, journey, plan, discreet } = useJourneyPlan();
  const [asking, setAsking] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  if (!ready) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label={t("Loading")}>
        <div className="h-44 animate-pulse rounded-3xl bg-forest-deep/15" />
        <div className="h-28 animate-pulse rounded-3xl bg-surface ring-1 ring-line" />
      </div>
    );
  }

  const answers = journey.assessment?.answers;
  return (
    <div className="flex flex-col gap-4">
      {!plan || !answers ? (
        <Intro onStart={() => setAsking(true)} />
      ) : plan.blocked ? (
        <HelpFirst note={plan.primary.type === "note" ? plan.primary.note : plan.openNotes[0]} onRedo={() => setAsking(true)} />
      ) : (
        <>
          <Where plan={plan} discreet={discreet} />
          <Next primary={plan.primary} answers={answers} onReview={() => setReviewing(true)} />
          <Today plan={plan} answers={answers} />
          <More plan={plan} discreet={discreet} smaller={Boolean(journey.smaller?.on)} onRedo={() => setAsking(true)} />
        </>
      )}
      <Assessment open={asking} onClose={() => setAsking(false)} start={answers} />
      {plan && (
        <ReviewSheet
          open={reviewing}
          onClose={() => setReviewing(false)}
          focus={plan.focus}
          quiet={plan.activeDays14 < 5}
          smaller={Boolean(journey.smaller?.on)}
        />
      )}
    </div>
  );
}

/** First time: what this is, and the way in. No plan is shown until he has answered. */
function Intro({ onStart }: { onStart: () => void }) {
  const t = useT();
  return (
    <>
      <section className="kayani-arcs rounded-3xl bg-forest-deep p-6 text-white">
        <p className="text-sm text-mint-strong">{t("My Journey")}</p>
        <h2 className="font-display mt-1 text-[1.625rem] font-extrabold leading-tight">{t("A plan built around you")}</h2>
        <p className="mt-2 text-sm text-mint">{t("A few questions about you. Then you'll see where to start, and what to do today.")}</p>
        <ul className="mt-4 space-y-2 text-sm text-mint">
          {["About 3 minutes", "Private: only you see your answers", "You can change your answers any time"].map((p) => (
            <li key={p} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mint-strong" />
              {t(p)}
            </li>
          ))}
        </ul>
        <button type="button" onClick={onStart} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-honey text-sm font-bold text-on-honey active:scale-[0.98]">
          {t("Start")} <ArrowRight size={16} />
        </button>
      </section>
      <p className="px-2 text-center text-[0.6875rem] text-ink-soft">{t("This isn't a doctor's test. It helps you see where to start.")}</p>
    </>
  );
}

/** A warning sign: help first, nothing else on the screen. */
function HelpFirst({ note, onRedo }: { note?: SafetyNote; onRedo: () => void }) {
  const t = useT();
  if (!note) return null;
  const crisis = note.level === "crisis";
  return (
    <section role="alert" className="rounded-3xl bg-red-50 p-5 ring-1 ring-red-300 dark:bg-red-950/40 dark:ring-red-800">
      <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
        {crisis ? <HeartHandshake size={20} /> : <AlertTriangle size={20} />}
        <h2 className="font-display text-lg font-extrabold">{say(note.title, t.lang)}</h2>
      </div>
      <p className="mt-2 text-sm text-ink">{say(note.body, t.lang)}</p>
      <div className="mt-4 flex flex-col gap-2">
        <button type="button" onClick={() => journeyStore.handle(note.id)} className="h-11 rounded-full bg-forest text-sm font-semibold text-white">
          {crisis ? t("I've talked to someone") : t("I've been seen")}
        </button>
        <button type="button" onClick={onRedo} className="tap-target text-xs font-medium text-ink-soft underline underline-offset-2">
          {t("I answered by mistake · change my answers")}
        </button>
      </div>
    </section>
  );
}

/** Where am I: stage, focus, and real progress (days he actually did something, not days he opened the app). */
function Where({ plan, discreet }: { plan: Plan; discreet: boolean }) {
  const t = useT();
  const focus = plan.focus.map((c) => say(concernById(c)!.name, t.lang));
  const days = Array.from({ length: 14 }, (_, i) => i);
  return (
    <section className="kayani-arcs rounded-3xl bg-forest-deep p-5 text-white">
      <p className="text-sm text-mint-strong">
        {say(STAGE_LABEL[plan.stage], t.lang)} · {t("Day {n}", { n: plan.day })}
      </p>
      <h2 className="font-display mt-1 text-xl font-extrabold leading-snug">
        {focus.length === 0
          ? t("Staying strong")
          : discreet
            ? t(focus.length === 1 ? "1 area to work on" : "{n} areas to work on", { n: focus.length })
            : focus.join(" · ")}
      </h2>
      <p className="mt-3 text-xs text-mint">{t("Days you did your plan (last 14)")}</p>
      <div className="mt-1.5 flex gap-1" role="img" aria-label={t("{n} of the last 14 days", { n: plan.activeDays14 })}>
        {days.map((i) => (
          <span key={i} className={`h-2 flex-1 rounded-full ${i < plan.activeDays14 ? "bg-mint-strong" : "bg-white/15"}`} />
        ))}
      </div>
      <p className="mt-2 text-xs text-mint">
        {t("{done} of {total} done today", { done: plan.doneToday, total: plan.tasks.length })}
      </p>
    </section>
  );
}

/** Tick a task: shared ones go to the Man-tab record, his own to his journey. */
function toggle(task: TaskDef, done: boolean) {
  if (task.activity) {
    if (done) feedStore.clearChoice(task.activity);
    else feedStore.setChoice(task.activity, "done");
  } else journeyStore.toggleDone(task.id);
}

function cautionFor(task: TaskDef, r: Set<Restriction>, t: T) {
  const lines = [task.safety, ...[...r].map((x) => task.caution?.[x])].filter(Boolean);
  return lines.map((l) => say(l!, t.lang));
}

/** The one most important thing to do next. */
function Next({ primary, answers, onReview }: { primary: Primary; answers: Answers; onReview: () => void }) {
  const t = useT();
  const toast = useToast();
  const label = <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t("Do this next")}</p>;
  const box = "rounded-3xl bg-surface p-5 ring-1 ring-line";

  if (primary.type === "done") {
    return (
      <section className={box}>
        {label}
        <p className="font-display mt-1 text-lg font-extrabold">{t("All done for today")}</p>
        <p className="mt-1 text-sm text-ink-soft">{t("That's the plan for today. Rest well, see you tomorrow.")}</p>
      </section>
    );
  }
  if (primary.type === "review") {
    return (
      <section className={box}>
        {label}
        <p className="font-display mt-1 text-lg font-extrabold">{t("Two-minute review")}</p>
        <p className="mt-1 text-sm text-ink-soft">{t("Two weeks in. Tell us how it's going and the plan adjusts.")}</p>
        <button type="button" onClick={onReview} className="mt-4 h-11 w-full rounded-full bg-honey text-sm font-bold text-on-honey">
          {t("Start the review")}
        </button>
      </section>
    );
  }
  if (primary.type === "note") {
    const n = primary.note;
    const urgent = n.level === "today";
    return (
      <section className={`rounded-3xl p-5 ring-1 ${urgent ? "bg-red-50 ring-red-300 dark:bg-red-950/40 dark:ring-red-800" : "bg-surface ring-line"}`}>
        {label}
        <div className="mt-1 flex items-start gap-2">
          <Stethoscope size={18} className="mt-1 shrink-0 text-forest" />
          <p className="font-display text-lg font-extrabold">{say(n.title, t.lang)}</p>
        </div>
        <p className="mt-1 text-sm text-ink-soft">{say(n.body, t.lang)}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => journeyStore.handle(n.id)} className="h-11 flex-1 rounded-full bg-honey text-sm font-bold text-on-honey">
            {urgent ? t("I've been seen") : t("Booked or done")}
          </button>
          {!urgent && (
            <button type="button" onClick={() => journeyStore.snooze(n.id)} className="h-11 rounded-full bg-bg px-5 text-sm font-semibold ring-1 ring-line">
              {t("Later")}
            </button>
          )}
        </div>
      </section>
    );
  }
  const task = primary.task;
  const r = restrictions(answers);
  const cautions = cautionFor(task, r, t);
  return (
    <section className={box}>
      {label}
      <p className="font-display mt-1 text-lg font-extrabold">{say(task.title, t.lang)}</p>
      <p className="mt-1 text-sm">{say(task.how, t.lang)}</p>
      <p className="mt-1 text-[0.8125rem] text-ink-soft">{say(task.why, t.lang)}</p>
      {cautions.map((c) => (
        <p key={c} className="mt-2 rounded-2xl bg-bg px-3 py-2 text-[0.8125rem] ring-1 ring-line">
          {c}
        </p>
      ))}
      {task.tracker ? (
        <Link href="/man" className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-honey text-sm font-bold text-on-honey">
          {t("Fill it in on Man")} <ArrowRight size={16} />
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => {
            toggle(task, false);
            haptic("done");
            toast(t("Done. Nice work."));
          }}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-honey text-sm font-bold text-on-honey active:scale-[0.98]"
        >
          <Check size={16} strokeWidth={3} /> {t("Done")}
        </button>
      )}
      {task.card && (
        <Link href={`/social/c/${task.card}`} className="tap-target mt-2 flex items-center justify-center gap-1 text-xs font-semibold text-forest">
          {t("See the full steps")} <ArrowRight size={13} />
        </Link>
      )}
    </section>
  );
}

/** The rest of today's plan: short rows; tap one to see how and why. */
function Today({ plan, answers }: { plan: Plan; answers: Answers }) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  const primaryId = plan.primary.type === "task" ? plan.primary.task.id : null;
  const rows = plan.tasks.filter((x) => x.task.id !== primaryId);
  if (rows.length === 0) return null;
  const r = restrictions(answers);
  return (
    <section className="rounded-3xl bg-surface p-2 ring-1 ring-line" aria-label={t("Also today")}>
      <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{t("Also today")}</p>
      <ul>
        {rows.map(({ task, done }) => {
          const isOpen = open === task.id;
          const cautions = cautionFor(task, r, t);
          return (
            <li key={task.id} className="border-b border-line last:border-0">
              <div className="flex items-center gap-1">
                {task.tracker ? (
                  <Link href="/man" aria-label={t("Fill it in on Man")} className="flex h-11 w-11 shrink-0 items-center justify-center">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full ${done ? "bg-forest text-white" : "ring-2 ring-line"}`}>{done && <Check size={14} strokeWidth={3} />}</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    aria-label={say(task.title, t.lang)}
                    onClick={() => {
                      toggle(task, done);
                      if (!done) haptic("done");
                    }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center"
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${done ? "bg-forest text-white" : "ring-2 ring-line"}`}>{done && <Check size={14} strokeWidth={3} />}</span>
                  </button>
                )}
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : task.id)} className="flex min-h-11 flex-1 items-center gap-2 py-2 pr-2 text-left">
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-semibold ${done ? "text-ink-soft line-through decoration-line" : ""}`}>{say(task.title, t.lang)}</span>
                    <span className="block text-[0.6875rem] text-ink-soft">{say(task.often, t.lang)}</span>
                  </span>
                  <ChevronDown size={16} className={`shrink-0 text-ink-soft transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
              </div>
              {isOpen && (
                <div className="space-y-1.5 px-3 pb-3 pl-12 text-[0.8125rem]">
                  <p>{say(task.how, t.lang)}</p>
                  <p className="text-ink-soft">{say(task.why, t.lang)}</p>
                  {cautions.map((c) => (
                    <p key={c} className="rounded-xl bg-bg px-3 py-2 ring-1 ring-line">
                      {c}
                    </p>
                  ))}
                  {task.card && (
                    <Link href={`/social/c/${task.card}`} className="tap-target inline-flex items-center gap-1 text-xs font-semibold text-forest">
                      {t("See the full steps")} <ArrowRight size={13} />
                    </Link>
                  )}
                  {task.tracker && (
                    <Link href="/man" className="tap-target inline-flex items-center gap-1 text-xs font-semibold text-forest">
                      {t("Fill it in on Man")} <ArrowRight size={13} />
                    </Link>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Quiet footer: next review, other open notes, what each area means, and changing the plan. */
function More({ plan, discreet, smaller, onRedo }: { plan: Plan; discreet: boolean; smaller: boolean; onRedo: () => void }) {
  const t = useT();
  const [confirm, setConfirm] = useState(false);
  const fmt = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(t.locale, { day: "numeric", month: "short", timeZone: "UTC" });
  };
  const primaryNote = plan.primary.type === "note" ? plan.primary.note.id : null;
  const otherNotes = plan.openNotes.filter((n) => n.id !== primaryNote);
  return (
    <section className="flex flex-col gap-3 px-1">
      {otherNotes.length > 0 && (
        <details className="rounded-3xl bg-surface px-4 py-3 ring-1 ring-line">
          <summary className="tap-target flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
            {t(otherNotes.length === 1 ? "1 check to book" : "{n} checks to book", { n: otherNotes.length })}
            <ChevronDown size={16} className="text-ink-soft" />
          </summary>
          <ul className="mt-2 space-y-3">
            {otherNotes.map((n) => (
              <li key={n.id} className="text-[0.8125rem]">
                <p className="font-semibold">{say(n.title, t.lang)}</p>
                <p className="text-ink-soft">{say(n.body, t.lang)}</p>
                <button type="button" onClick={() => journeyStore.handle(n.id)} className="tap-target mt-1 text-xs font-semibold text-forest">
                  {t("Booked or done")}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {plan.focus.length > 0 && !discreet && (
        <details className="rounded-3xl bg-surface px-4 py-3 ring-1 ring-line">
          <summary className="tap-target flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
            {t("About your focus areas")}
            <ChevronDown size={16} className="text-ink-soft" />
          </summary>
          <ul className="mt-2 space-y-3">
            {plan.focus.map((id) => {
              const c = concernById(id)!;
              return (
                <li key={id} className="text-[0.8125rem]">
                  <p className="font-semibold">{say(c.name, t.lang)}</p>
                  <p className="text-ink-soft">{say(c.about, t.lang)}</p>
                  {c.refs.map((r) => (
                    <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" className="tap-target mt-1 inline-flex items-center gap-1 text-xs font-semibold text-forest">
                      {r.label} <ExternalLink size={12} />
                    </a>
                  ))}
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <p className="text-center text-[0.6875rem] text-ink-soft">
        {plan.reviewDue ? t("Your review is due") : t("Next review: {date}", { date: fmt(plan.reviewOn) })}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-4 text-xs font-medium text-ink-soft">
        <button type="button" onClick={onRedo} className="tap-target underline underline-offset-2">
          {t("Change my answers")}
        </button>
        <button type="button" onClick={() => journeyStore.setSmaller(!smaller)} className="tap-target underline underline-offset-2">
          {smaller ? t("Back to the full plan") : t("Make it smaller")}
        </button>
        <button type="button" onClick={() => setConfirm(true)} className="tap-target underline underline-offset-2">
          {t("Start over")}
        </button>
      </div>
      {confirm && (
        <div className="rounded-3xl bg-surface p-4 text-sm ring-1 ring-line" role="group" aria-label={t("Start over")}>
          <p>{t("Clear your answers and plan? Your records on Man stay.")}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                journeyStore.reset();
                setConfirm(false);
              }}
              className="h-11 flex-1 rounded-full bg-forest text-sm font-semibold text-white"
            >
              {t("Clear")}
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="h-11 flex-1 rounded-full bg-bg text-sm font-semibold ring-1 ring-line">
              {t("Cancel")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
