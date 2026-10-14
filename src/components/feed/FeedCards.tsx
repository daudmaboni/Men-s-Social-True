"use client";

import Link from "next/link";
import { BookOpen, Clock, Flame, Lightbulb, PartyPopper } from "lucide-react";
import { useToast } from "@/components/motion/Toast";
import { feedStore } from "@/lib/feed/store";
import type { HomeFeed } from "./useHomeFeed";
import { useT } from "@/lib/i18n";

/** Small "Why am I seeing this?" link that opens a one-line reason. */
export function Why({ text }: { text: string }) {
  const t = useT();
  return (
    <details className="mt-1.5 text-[11px] text-ink-soft">
      <summary className="cursor-pointer select-none list-none font-medium underline decoration-line underline-offset-2">
        {t("Why am I seeing this?")}
      </summary>
      <p className="mt-1">{t(text)}</p>
    </details>
  );
}

const NEW_USER_WHY =
  "Suggested for everyone while you're new. After the short assessment, this adapts to your goals.";

export function TodayCard({ f }: { f: HomeFeed }) {
  const pct = f.total ? Math.round((f.doneCount / f.total) * 100) : 0;
  const t = useT();
  return (
    <section className="rounded-3xl bg-forest-deep p-5 text-white">
      <p className="text-sm text-mint-strong">{t(f.greeting)}</p>
      {f.isNew ? (
        <>
          <p className="mt-1 text-2xl font-bold">{t("Try your first activity")}</p>
          <p className="mt-1 text-sm text-mint">{t("Pick anything below. Small steps count.")}</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-2xl font-bold">
            {t("{done} of {total} done today", { done: f.doneCount, total: f.total })}
          </p>
          <div
            className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/15"
            role="progressbar"
            aria-label={t("Activities done today")}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-mint-strong transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(pct, f.doneCount ? 6 : 0)}%` }}
            />
          </div>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="text-mint">
              <span className="text-lg font-bold text-white">{f.points}</span> {t("points · Level {n}", { n: f.level.level })}
            </span>
            {f.streak > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 font-semibold">
                <Flame size={13} className="text-mint-strong" />
                {t(f.streak === 1 ? "{n} day in a row" : "{n} days in a row", { n: f.streak })}
              </span>
            )}
          </div>
          <p className="mt-2 text-[11px] text-mint/80">
            {f.pointsToday > 0 ? t("+{n} today · ", { n: f.pointsToday }) : ""}
            {t("{n} points to Level {level}", { n: f.level.toNext, level: f.level.level + 1 })}
          </p>
        </>
      )}
    </section>
  );
}

export function ReminderCard({ f }: { f: HomeFeed }) {
  const showToast = useToast();
  const t = useT();
  const a = f.reminder;
  if (!a) return null;
  const title = f.discreet ? a.discreetTitle : a.title;
  return (
    <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
      <p className="flex items-center gap-1.5 text-xs font-medium text-forest">
        <Clock size={13} /> {t("Now")} · {t(f.slot)}
      </p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{t(title)}</p>
          <p className="text-xs text-ink-soft">{t(a.detail)}</p>
        </div>
        {a.tracker ? (
          <a href={`#${a.tracker}`} className="shrink-0 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white">
            {t("Start")}
          </a>
        ) : (
          <button
            onClick={() => {
              feedStore.setChoice(a.id, "done");
              showToast(t("+{n} points", { n: a.points }));
            }}
            className="shrink-0 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95"
          >
            {t("Done")}
          </button>
        )}
      </div>
      <Why text={f.isNew ? NEW_USER_WHY : a.why} />
    </section>
  );
}

export function LessonCard({ f }: { f: HomeFeed }) {
  const l = f.lesson;
  const read = f.lessonRead(l.id);
  const t = useT();
  const sw = t.lang === "sw";
  return (
    <Link href={`/learn/${l.id}`} className="block rounded-3xl bg-surface p-5 ring-1 ring-line transition-transform active:scale-[0.99]">
      <p className="flex items-center gap-1.5 text-xs text-ink-soft">
        <BookOpen size={13} /> {t("Lesson")} · {t("{n} min", { n: l.minutes })} · {t(l.topic)}
      </p>
      <p className="mt-1 font-semibold">{sw && l.titleSw ? l.titleSw : l.title}</p>
      <p className="mt-1 text-sm text-ink-soft">{sw && l.summarySw ? l.summarySw : l.summary}</p>
      <p className="mt-3 text-xs font-semibold text-forest">{read ? t("Read ✓ · Open again") : t("Read now · +{n} points", { n: l.points })}</p>
    </Link>
  );
}

export function TipCard({ f }: { f: HomeFeed }) {
  const t = useT();
  return (
    <section className="rounded-3xl bg-mint p-5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-forest">
        <Lightbulb size={13} /> {t("Quick tip")}
      </p>
      <p className="mt-1 text-sm font-medium text-forest-deep">{t(f.tip)}</p>
    </section>
  );
}

export function EndCard() {
  const t = useT();
  return (
    <section className="rounded-3xl bg-surface p-6 text-center ring-1 ring-line">
      <PartyPopper className="mx-auto text-forest" size={28} />
      <p className="mt-2 text-lg font-bold">{t("You're all set for today")}</p>
      <p className="mt-1 text-sm text-ink-soft">{t("Come back tomorrow for a fresh start. Your trends are below.")}</p>
      <div className="mt-4 flex justify-center gap-2">
        <Link href="/social" className="rounded-full px-4 py-2.5 text-sm font-semibold ring-1 ring-line">
          {t("Explore Social")}
        </Link>
        <Link href="/learn" className="rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-white">
          {t("Browse lessons")}
        </Link>
      </div>
    </section>
  );
}
