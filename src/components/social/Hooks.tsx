"use client";

// The parts of Discover that pull a man back (Step 86): question-first slides, series parts, "try it for
// N days" challenges, the daily drop, "You, then and now", real men's stories, and sharing on WhatsApp.
// Every text goes through t() (from useT() in ActionFeed), so it has a Kiswahili version.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleHelp, Clock, Copy, Flag, Gift, Lock, MoreHorizontal, Quote, Sparkles, TrendingDown, TrendingUp, X } from "lucide-react";
import Sheet from "@/components/motion/Sheet";
import { useToast } from "@/components/motion/Toast";
import { contentHref } from "./ContentCards";
import { haptic } from "@/lib/motion/haptics";
import { flyPoints } from "@/lib/motion/flyPoints";
import { trackContent } from "@/lib/analytics/track";
import { feedStore, useFeed } from "@/lib/feed/store";
import { dateKey } from "@/lib/progress/dates";
import { CIRCLE_LABEL } from "@/lib/content/circles";
import {
  CHALLENGE_DAY_POINTS,
  CHALLENGE_DONE_POINTS,
  challengeState,
  shareText,
  untilText,
  whatsappLink,
  type ChallengeEntry,
} from "@/lib/content/hooks";
import type { ActionSpec, CardAsk, ChallengeId, ContentItem } from "@/lib/content/types";
import type { ThenNow, ThenNowRow } from "@/lib/progress/thenNow";
import type { Story } from "@/lib/social/stories";
import type { T } from "@/lib/i18n";
import { useContentSw } from "@/lib/me/contentLang";

/* ───────── Question-first slide ───────── */

export function AskSlide({ ask, title, steps, t, onAnswer }: { ask: CardAsk; title: string; steps: number; t: T; onAnswer?: () => void }) {
  const sw = useContentSw(); // Step 94: content language (Kiswahili by default)
  const [guess, setGuess] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const q = sw ? ask.qSw : ask.q;
  const a = sw ? ask.aSw : ask.a;
  const reveal = (g: boolean | null) => {
    setGuess(g);
    setOpen(true);
    haptic("tick");
    onAnswer?.();
  };
  const right = ask.kind === "truefalse" && guess !== null && guess === Boolean(ask.truth);
  return (
    <div className="relative flex h-full w-full flex-col overflow-y-auto bg-forest-deep px-5 py-4 text-white">
      <span className="pointer-events-none absolute -right-4 -top-6 text-white/[0.06]" aria-hidden>
        <CircleHelp size={170} />
      </span>
      <p className="relative text-[0.6875rem] font-bold uppercase tracking-wider text-mint-strong">{t(ask.kind === "truefalse" ? "True or false?" : "Did you know?")}</p>
      <p className="relative mt-1 line-clamp-1 text-[0.75rem] text-white/60">{title}</p>
      <div className="relative my-auto py-2">
        <p className={`font-display font-bold leading-tight ${q.length > 90 ? "text-[1.1875rem]" : "text-[1.4375rem]"}`}>{q}</p>
        {!open ? (
          ask.kind === "truefalse" ? (
            <div className="mt-4 flex gap-2">
              <button onClick={() => reveal(true)} className="flex-1 rounded-full bg-white py-2.5 text-sm font-bold text-forest-deep active:scale-95">
                {t("True")}
              </button>
              <button onClick={() => reveal(false)} className="flex-1 rounded-full bg-white/10 py-2.5 text-sm font-bold ring-1 ring-white/30 active:scale-95">
                {t("False")}
              </button>
            </div>
          ) : (
            <button onClick={() => reveal(null)} className="mt-4 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-forest-deep active:scale-95">
              {t("See the answer")}
            </button>
          )
        ) : (
          <div className="mt-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/15" aria-live="polite">
            {ask.kind === "truefalse" && (
              <p className={`text-sm font-bold ${right ? "text-mint-strong" : "text-honey"}`}>
                {t(right ? "Right!" : "Not quite.")} {t(ask.truth ? "It's true." : "It's a myth.")}
              </p>
            )}
            <p className="mt-0.5 text-[0.9375rem] leading-snug text-white/95">{a}</p>
          </div>
        )}
      </div>
      <p className="relative text-[0.8125rem] font-semibold text-white/80">{t(steps === 1 ? "Swipe for the step" : "Swipe for {n} steps", { n: steps })}</p>
    </div>
  );
}

/* ───────── Series ───────── */

export interface SeriesInfo {
  name: string;
  part: number;
  total: number;
  /** One line about the next part. */
  tease?: string;
  /** The next part opens tomorrow (after he does this one) rather than straight away. */
  wait: boolean;
  last: boolean;
}

export function NextPartSlide({ s, t }: { s: SeriesInfo; t: T }) {
  return (
    <div className="flex h-full w-full flex-col justify-center bg-honey px-5 py-4 text-on-honey">
      <p className="text-[0.6875rem] font-bold uppercase tracking-wider">{s.name}</p>
      {s.last ? (
        <>
          <p className="mt-2 font-display text-[1.375rem] font-bold leading-tight">{t("This is the last part.")}</p>
          <p className="mt-1.5 text-[0.9375rem] leading-snug">{t("Do it, tap \"I did it\", and the whole series is yours.")}</p>
        </>
      ) : (
        <>
          <p className="mt-2 font-display text-[1.375rem] font-bold leading-tight">{t("Next: part {n} of {total}", { n: s.part + 1, total: s.total })}</p>
          {s.tease && <p className="mt-1.5 text-[1rem] font-semibold leading-snug">{s.tease}</p>}
          <p className="mt-3 flex items-center gap-1.5 text-[0.8125rem] font-semibold">
            <Lock size={14} /> {t(s.wait ? "Opens tomorrow, after you do this one." : "Opens as soon as you do this one.")}
          </p>
        </>
      )}
    </div>
  );
}

/** A part he can't open yet, in the series view. */
export function LockedPart({ part, total, opensOn, t }: { part: number; total: number; opensOn: string | null; t: T }) {
  const today = dateKey(new Date());
  return (
    <div className="flex items-center gap-3 rounded-[20px] bg-surface p-4 ring-1 ring-dashed ring-line">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-line text-ink-soft">
        <Lock size={18} />
      </span>
      <div>
        <p className="text-sm font-bold">{t("Part {n} of {total}", { n: part, total })}</p>
        <p className="text-xs text-ink-soft">
          {opensOn ? t(opensOn > today ? "Opens tomorrow" : "Open now: pull down to refresh") : t("Opens after you do the part before")}
        </p>
      </div>
    </div>
  );
}

/* ───────── Challenges ───────── */

/** "Try it 7 days" under a card, or where he is in it. */
export function ChallengeButton({ item, days, t }: { item: ContentItem; days: number; t: T }) {
  const feed = useFeed();
  const showToast = useToast();
  const entry = feed.challenges?.[item.id];
  const today = dateKey(new Date());
  if (entry && !entry.finished) {
    const st = challengeState(entry, today);
    return (
      <ChallengeDayButton id={item.id} entry={entry} compact t={t}>
        {t("Day {n} of {total}", { n: st.day, total: st.length })}
      </ChallengeDayButton>
    );
  }
  return (
    <button
      onClick={() => {
        feedStore.startChallenge(item.id, days);
        trackContent(item.id, "challenge_start");
        haptic("tick");
        showToast(t("Challenge started. It's at the top of Discover every day."));
      }}
      className="flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 py-2.5 text-sm font-bold text-forest ring-1 ring-line active:scale-[0.98]"
    >
      <Flag size={15} /> {entry?.finished ? t("Again: {n} days", { n: days }) : t("Try it {n} days", { n: days })}
    </button>
  );
}

function ChallengeDayButton({ id, entry, compact, t, children }: { id: string; entry: ChallengeEntry; compact?: boolean; t: T; children?: React.ReactNode }) {
  const showToast = useToast();
  const today = dateKey(new Date());
  const st = challengeState(entry, today);
  const doDay = (el: HTMLElement) => {
    if (st.doneToday) {
      feedStore.undoChallengeDay(id);
      return;
    }
    const finishing = st.done + 1 >= st.length;
    feedStore.challengeDay(id, CHALLENGE_DONE_POINTS);
    haptic(finishing ? "success" : "done");
    flyPoints(el, CHALLENGE_DAY_POINTS + (finishing ? CHALLENGE_DONE_POINTS : 0));
    if (finishing) {
      trackContent(id, "challenge_finish");
      showToast(t("Challenge done! {n} days. That's discipline.", { n: st.length }));
    } else showToast(t("Day {n} done. See you tomorrow.", { n: st.done + 1 }));
  };
  return (
    <button
      onClick={(e) => doDay(e.currentTarget)}
      aria-pressed={st.doneToday}
      className={`flex shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-bold active:scale-[0.98] ${compact ? "px-3.5 py-2.5" : "px-4 py-2"} ${
        st.doneToday ? "bg-mint text-forest" : "bg-honey text-on-honey"
      }`}
    >
      {st.doneToday ? <Check size={15} /> : <Flag size={15} />}
      {children ?? (st.doneToday ? t("Done today") : t("I did today's"))}
      {!st.doneToday && !children && <span className="text-[0.6875rem] opacity-80">+{CHALLENGE_DAY_POINTS}</span>}
    </button>
  );
}

/** His challenges, at the top of Discover: one row each, with the days as dots. */
export function ChallengeStrip({ items, t }: { items: ContentItem[]; t: T }) {
  const feed = useFeed();
  const sw = useContentSw(); // Step 94: content language (Kiswahili by default)
  const today = dateKey(new Date());
  const list = Object.entries(feed.challenges ?? {})
    .map(([id, e]) => ({ id, e, st: challengeState(e, today), item: items.find((i) => i.id === id) }))
    .filter((x) => x.item && !x.st.stale && (!x.e.finished || x.e.finished.localDate === today))
    .sort((a, b) => Number(a.st.doneToday) - Number(b.st.doneToday) || b.e.at.localeCompare(a.e.at));
  if (!feed.ready || !list.length) return null;
  return (
    <section aria-label={t("Your challenges")} className="space-y-2">
      {list.map(({ id, e, st, item }) => (
        <div key={id} className="rounded-[20px] bg-surface p-3 ring-1 ring-line">
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${e.finished ? "bg-honey text-on-honey" : "bg-mint text-forest"}`}>
              {e.finished ? <Gift size={18} /> : <Flag size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-forest">
                {e.finished ? t("Challenge done") : t("Day {n} of {total}", { n: st.day, total: st.length })}
              </p>
              <Link href={contentHref(id)} className="line-clamp-1 text-sm font-bold">
                {sw && item!.titleSw ? item!.titleSw : item!.title}
              </Link>
              <div className="mt-1.5 flex gap-1" aria-label={t("{n} of {total} days done", { n: st.done, total: st.length })}>
                {Array.from({ length: st.length }, (_, i) => (
                  <span key={i} className={`h-1.5 flex-1 rounded-full ${i < st.done ? "bg-forest" : "bg-line"}`} />
                ))}
              </div>
            </div>
          </div>
          {!e.finished && (
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <button
                onClick={() => feedStore.quitChallenge(id)}
                className="px-1 text-xs font-semibold text-ink-soft underline-offset-2 hover:underline"
              >
                {t("Stop")}
              </button>
              <ChallengeDayButton id={id} entry={e} t={t} />
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

/* ───────── The daily drop ───────── */

export function DropBanner({ fresh, next, onGo, t }: { fresh: number; next: Date | null; onGo: () => void; t: T }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(i);
  }, []);
  if (fresh > 0) {
    return (
      <button onClick={onGo} className="flex w-full items-center gap-3 rounded-[20px] bg-honey px-4 py-3 text-left text-on-honey active:scale-[0.99]">
        <Sparkles size={20} className="shrink-0" />
        <span className="flex-1">
          <span className="block text-sm font-bold">{t("Today's drop is here")}</span>
          <span className="block text-xs opacity-80">{t(fresh === 1 ? "1 new card" : "{n} new cards", { n: fresh })}</span>
        </span>
        <ArrowRight size={18} />
      </button>
    );
  }
  if (!next) return null;
  return (
    <p className="edge-pad flex items-center gap-1.5 text-xs text-ink-soft">
      <Clock size={13} /> {t("Next drop {when}", { when: untilText(next.getTime() - now, t.lang === "sw") })}
    </p>
  );
}

/* ───────── You, then and now ───────── */

const METRIC_LABEL: Record<ThenNowRow["metric"], string> = {
  sleep: "Sleep a night",
  water: "Water a day",
  energy: "Energy",
  mood: "Mood",
  cards: "Things you tried",
};

function fmt(r: ThenNowRow, v: number, t: T): string {
  if (r.metric === "sleep") {
    const h = Math.floor(v / 60);
    const m = Math.round(v % 60);
    return t("{h} h {m} min", { h, m });
  }
  if (r.metric === "water") return `${(v / 1000).toFixed(1)} L`;
  if (r.metric === "cards") return String(Math.round(v));
  return `${v.toFixed(1)}/5`;
}

export function ThenNowCard({ data, onClose, t }: { data: ThenNow; onClose: () => void; t: T }) {
  return (
    <section className="relative rounded-[20px] bg-forest-deep p-4 text-white" aria-label={t("You, then and now")}>
      <button onClick={onClose} aria-label={t("Close")} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-white/70">
        <X size={16} />
      </button>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-mint-strong">
        <TrendingUp size={14} /> {t("You, then and now")}
      </p>
      <p className="mt-1 pr-8 font-display text-lg font-bold leading-snug">
        {t(data.basis === "month" ? "A month ago vs the last 7 days" : "Your first week vs the last 7 days")}
      </p>
      <ul className="mt-3 divide-y divide-white/10">
        {data.rows.map((r) => (
          <li key={r.metric} className="flex items-center gap-2 py-2 text-sm">
            <span className="flex-1 text-white/80">{t(METRIC_LABEL[r.metric])}</span>
            <span className="tabular-nums text-white/60">{fmt(r, r.then, t)}</span>
            <ArrowRight size={13} className="text-white/40" />
            <span className={`flex items-center gap-1 font-bold tabular-nums ${r.better ? "text-mint-strong" : "text-white"}`}>
              {fmt(r, r.now, t)}
              {Math.abs(r.change) > 0.01 && (r.better ? <TrendingUp size={13} /> : <TrendingDown size={13} className="text-white/50" />)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[0.6875rem] text-white/55">{t("From what you recorded yourself. It shows change, not what caused it.")}</p>
    </section>
  );
}

/* ───────── Real men's stories ───────── */

export function StoryCard({ story, onCircle, t }: { story: Story; onCircle: (c: ChallengeId) => void; t: T }) {
  const sw = useContentSw(); // Step 94: content language (Kiswahili by default)
  return (
    <section className="rounded-[20px] bg-mint p-4 text-forest-deep" aria-label={t("A man's story")}>
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-forest">
        <Quote size={14} /> {t("A man's story")}
      </p>
      <p className="mt-2 font-display text-[1.0625rem] font-bold leading-snug">“{sw ? story.textSw : story.text}”</p>
      <p className="mt-2 text-xs font-semibold text-forest">{sw ? story.whoSw : story.who}</p>
      <p className="mt-1 text-[0.6875rem] text-forest/70">{t("Shared with his permission. Name left out.")}</p>
      {story.circle && (
        <button onClick={() => onCircle(story.circle!)} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-forest px-3.5 py-2 text-xs font-bold text-white">
          {t("Things to try for: {challenge}", { challenge: t(CIRCLE_LABEL[story.circle]).toLowerCase() })} <ArrowRight size={13} />
        </button>
      )}
    </section>
  );
}

/* ───────── Sharing on WhatsApp ───────── */

export function ShareSheet({ open, onClose, item, spec, above = false, t }: { open: boolean; onClose: () => void; item: ContentItem; spec?: ActionSpec; above?: boolean; t: T }) {
  const showToast = useToast();
  const sw = useContentSw(); // Step 94: content language (Kiswahili by default)
  const url = typeof location === "undefined" ? contentHref(item.id) : `${location.origin}${contentHref(item.id)}?s=share`;
  const text = shareText(spec, url, sw);
  const done = () => {
    trackContent(item.id, "share");
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={t("Send to a friend")} above={above}>
      <p className="rounded-2xl bg-bg p-3 text-sm text-ink-soft ring-1 ring-line">{text}</p>
      <p className="mt-2 text-xs text-ink-soft">{t("Only this plain line goes with the link, so nothing private shows on his screen.")}</p>
      <div className="mt-4 grid gap-2">
        <a
          href={whatsappLink(text)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={done}
          className="flex items-center justify-center gap-2 rounded-full bg-[#1f9e55] py-3 text-sm font-bold text-white"
        >
          {t("Send on WhatsApp")}
        </a>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              showToast(t("Link copied"));
              done();
            } catch {
              showToast(t("Couldn't copy. Long-press the text above."));
            }
          }}
          className="flex items-center justify-center gap-2 rounded-full py-3 text-sm font-bold ring-1 ring-line"
        >
          <Copy size={16} /> {t("Copy link")}
        </button>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button
            onClick={async () => {
              try {
                await navigator.share({ text });
                done();
              } catch {}
            }}
            className="flex items-center justify-center gap-2 rounded-full py-3 text-sm font-bold ring-1 ring-line"
          >
            <MoreHorizontal size={16} /> {t("More apps")}
          </button>
        )}
      </div>
    </Sheet>
  );
}
