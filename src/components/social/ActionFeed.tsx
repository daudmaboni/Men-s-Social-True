"use client";

// Discover as a feed of things to DO, not things to read about.
// Top: "What's your challenge?" circles, like Instagram stories. Below: one endless column of
// action cards. Each card is a carousel he swipes through: the hook, what he needs, the steps,
// why it works. Then: "Useful", share, save, and "I did it".

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BatteryCharging,
  Bookmark,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Hand,
  Heart,
  Leaf,
  MessageCircle,
  Moon,
  Send,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";
import Cover from "./Cover";
import { contentHref } from "./ContentCards";
import { useToast } from "@/components/motion/Toast";
import { useLibrary } from "@/lib/content/useLibrary";
import { actionOf } from "@/lib/content/actions";
import type { ActionResult, ActionSpec, ActionType, ContentItem } from "@/lib/content/types";
import { socialStore, useSocial } from "@/lib/social/store";
import { triedStore, useTried, type FeedFilter } from "@/lib/social/tried";
import { trackContent } from "@/lib/analytics/track";
import { inviteToAccount } from "@/components/account/AccountInvite";
import { useT, type T } from "@/lib/i18n";

const CHALLENGES: { id: FeedFilter; label: string; icon: typeof Timer }[] = [
  { id: "all", label: "For you", icon: Sparkles },
  { id: "last", label: "Last longer", icon: Timer },
  { id: "hard", label: "Stronger erections", icon: Zap },
  { id: "her", label: "Satisfy her", icon: Flame },
  { id: "mixes", label: "Natural mixes", icon: Leaf },
  { id: "train", label: "Exercises", icon: Dumbbell },
  { id: "reset", label: "Quit porn", icon: Brain },
  { id: "desire", label: "Desire and round two", icon: BatteryCharging },
];

const TYPE_LABEL: Record<ActionType, string> = {
  technique: "Technique",
  position: "Positions",
  mix: "Natural mix",
  exercise: "Exercise",
  food: "Food",
  habit: "Daily habit",
  mind: "Mindset",
};

const RESULT_LABEL: Record<ActionResult, string> = {
  tonight: "Works tonight",
  days: "Results in days",
  weeks2: "Feel it in 1–3 weeks",
  weeks4: "Feel it in 3–6 weeks",
  daily: "Daily habit",
};

const TYPE_ICON: Record<ActionType, typeof Timer> = {
  technique: Flame,
  position: Heart,
  mix: Leaf,
  exercise: Dumbbell,
  food: Leaf,
  habit: Moon,
  mind: Brain,
};

const PAGE = 8;
const TIMER_ID = "tool-pelvic-floor";

type Card = { item: ContentItem; spec: ActionSpec };

export function ActionFeedSkeleton() {
  const t = useT();
  return (
    <div className="space-y-5" aria-busy="true" aria-label={t("Loading")}>
      <div className="flex gap-4 overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[68px] w-[68px] shrink-0 animate-pulse rounded-full bg-line" />
        ))}
      </div>
      <div className="aspect-square animate-pulse rounded-[28px] bg-forest-deep/15" />
    </div>
  );
}

export default function ActionFeed() {
  const { items } = useLibrary();
  const tried = useTried();
  const social = useSocial();
  const t = useT();
  const [shown, setShown] = useState(PAGE);
  const top = useRef<HTMLDivElement>(null);
  const filter = tried.filter;

  const all = useMemo<Card[]>(
    () => items.flatMap((item) => {
      const spec = actionOf(item);
      return spec && item.status !== "archived" ? [{ item, spec }] : [];
    }),
    [items],
  );

  // His challenge first; what he already did sinks to the bottom (still there to repeat).
  // The order is fixed when he opens the feed or changes the challenge, so cards don't jump under his thumb.
  const [doneAtStart, setDoneAtStart] = useState<Record<string, string>>({});
  useEffect(() => {
    if (tried.ready) setDoneAtStart(tried.done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tried.ready, filter]);
  const cards = useMemo(() => {
    const picked = filter === "all" ? all : all.filter((c) => c.spec.challenges.includes(filter));
    return [...picked.filter((c) => !doneAtStart[c.item.id]), ...picked.filter((c) => doneAtStart[c.item.id])];
  }, [all, filter, doneAtStart]);

  // Load more cards as he nears the end
  const sentinel = useRef<HTMLDivElement>(null);
  const more = cards.length > shown;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setShown((n) => n + PAGE), { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more, shown]);

  const pick = (id: FeedFilter) => {
    triedStore.setFilter(id === filter && id !== "all" ? "all" : id);
    setShown(PAGE);
    top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  if (!tried.ready || !social.ready) return <ActionFeedSkeleton />;

  const left = (id: FeedFilter) => (id === "all" ? all : all.filter((c) => c.spec.challenges.includes(id))).some((c) => !tried.done[c.item.id]);
  const current = CHALLENGES.find((c) => c.id === filter) ?? CHALLENGES[0];

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-5">
      <section aria-labelledby="challenge-h" className="-mx-5 scroll-mt-4 lg:mx-0" ref={top}>
        <h2 id="challenge-h" className="px-5 font-display text-[20px] font-bold leading-tight lg:px-0">
          {t("What's your challenge?")}
        </h2>
        <div role="tablist" aria-label={t("What's your challenge?")} className="no-scrollbar mt-3 flex gap-3.5 overflow-x-auto px-5 pb-1 lg:px-0">
          {CHALLENGES.map(({ id, label, icon: Icon }) => {
            const on = filter === id;
            const fresh = left(id);
            return (
              <button
                key={id}
                role="tab"
                aria-selected={on}
                onClick={() => pick(id)}
                className="flex w-[74px] shrink-0 flex-col items-center gap-1.5 transition-transform active:scale-95"
              >
                {/* The ring is coloured while there are cards here he hasn't tried yet */}
                <span
                  className={`rounded-full p-[2.5px] ${fresh ? "bg-[conic-gradient(from_200deg,var(--honey),var(--mint-strong),var(--forest),var(--honey))]" : "bg-line"}`}
                >
                  <span className="block rounded-full bg-bg p-[2.5px]">
                    <span
                      className={`flex h-[60px] w-[60px] items-center justify-center rounded-full transition-colors ${on ? "bg-forest text-white" : "bg-surface text-forest ring-1 ring-line"}`}
                    >
                      <Icon size={24} strokeWidth={2} aria-hidden />
                    </span>
                  </span>
                </span>
                <span className={`line-clamp-2 text-center text-[11px] leading-tight ${on ? "font-bold text-ink" : "font-medium text-ink-soft"}`}>{t(label)}</span>
              </button>
            );
          })}
        </div>
      </section>

      {filter !== "all" && (
        <p className="flex items-center justify-between gap-2 text-xs text-ink-soft">
          <span>
            {t("{n} things to try for: {challenge}", { n: cards.length, challenge: t(current.label).toLowerCase() })}
          </span>
          <button onClick={() => pick("all")} className="font-semibold text-forest">
            {t("Show all")}
          </button>
        </p>
      )}

      <div className="space-y-6">
        {cards.slice(0, shown).map((c, i) => (
          <ActionPost key={`${filter}-${c.item.id}`} card={c} first={i === 0} done={Boolean(tried.done[c.item.id])} liked={Boolean(tried.liked[c.item.id])} saved={Boolean(social.bookmarks[c.item.id])} />
        ))}
      </div>

      {more ? (
        <div ref={sentinel} className="h-[40vh] animate-pulse rounded-[28px] bg-surface ring-1 ring-line" aria-hidden />
      ) : (
        <EndOfFeed filter={filter} onPick={pick} t={t} />
      )}
    </div>
  );
}

function EndOfFeed({ filter, onPick, t }: { filter: FeedFilter; onPick: (id: FeedFilter) => void; t: T }) {
  return (
    <section className="rounded-[28px] bg-forest-deep p-6 text-center text-white">
      <p className="font-display text-xl font-bold">{t("You've seen them all")}</p>
      <p className="mt-1 text-sm text-mint">{t("Pick one you haven't done yet, and do it tonight.")}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {CHALLENGES.filter((c) => c.id !== filter && c.id !== "all")
          .slice(0, 4)
          .map((c) => (
            <button key={c.id} onClick={() => onPick(c.id)} className="rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold text-white ring-1 ring-white/20">
              {t(c.label)}
            </button>
          ))}
      </div>
      <Link href="/social?tab=community" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-mint-strong">
        <MessageCircle size={15} /> {t("Ask the community")}
      </Link>
    </section>
  );
}

/** One card in the feed, Instagram-post style. */
function ActionPost({ card, first, done, liked, saved }: { card: Card; first: boolean; done: boolean; liked: boolean; saved: boolean }) {
  const { item, spec } = card;
  const t = useT();
  const sw = t.lang === "sw";
  const showToast = useToast();
  const title = sw && item.titleSw ? item.titleSw : item.title;
  const hook = sw && item.summarySw ? item.summarySw : item.summary;
  const why = sw ? spec.whySw : spec.why;
  const need = sw ? spec.needSw : spec.need;
  const TypeIcon = TYPE_ICON[spec.type];
  const href = contentHref(item.id);

  const slides: React.ReactNode[] = [
    <HookSlide key="hook" item={item} spec={spec} title={title} hook={hook} first={first} t={t} />,
    ...(need?.length ? [<NeedSlide key="need" need={need} t={t} />] : []),
    ...spec.steps.map((s, i) => (
      <StepSlide key={`s${i}`} n={i + 1} total={spec.steps.length} title={sw ? s.titleSw : s.title} text={sw ? s.textSw : s.text} t={t} />
    )),
    ...(why ? [<WhySlide key="why" why={why} t={t} />] : []),
  ];

  const share = async () => {
    const url = `${location.origin}${href}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast(t("Link copied"));
    } catch {
      // he closed the share sheet
    }
  };

  return (
    <article className="overflow-hidden rounded-[28px] bg-surface ring-1 ring-line" aria-label={title}>
      <header className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint text-forest">
          <TypeIcon size={17} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold leading-tight">{t(TYPE_LABEL[spec.type])}</p>
          <p className="truncate text-[11px] text-ink-soft">{t("{n} min", { n: item.minutes })} · {item.origin ? "@kayaniherbs" : "Kayani Herbs"}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${spec.results === "tonight" ? "bg-honey text-on-honey" : "bg-mint text-forest"}`}
        >
          {t(RESULT_LABEL[spec.results])}
        </span>
      </header>

      <Carousel label={title} t={t}>
        {slides}
      </Carousel>

      <div className="flex items-center gap-1 px-2 pt-1">
        <IconButton
          label={t(liked ? "Marked useful" : "Useful")}
          pressed={liked}
          onClick={() => {
            const now = triedStore.toggleLike(item.id);
            if (now) showToast(t("Marked as useful"));
          }}
        >
          <Heart size={23} className={liked ? "text-red-500" : ""} fill={liked ? "currentColor" : "none"} />
        </IconButton>
        <IconButton label={t("Share")} onClick={share}>
          <Send size={21} />
        </IconButton>
        <Link href={href} className="ml-1 flex items-center gap-1 rounded-full px-2 py-2 text-xs font-semibold text-ink-soft">
          {t("Full page")} <ArrowRight size={13} />
        </Link>
        <span className="flex-1" />
        <IconButton
          label={t(saved ? "Remove from saved" : "Save for later")}
          pressed={saved}
          onClick={() => {
            const now = socialStore.toggleBookmark(item.id);
            if (now) trackContent(item.id, "save");
            showToast(t(now ? "Saved for later" : "Removed from saved"));
            if (now) inviteToAccount("first-save");
          }}
        >
          <Bookmark size={22} fill={saved ? "currentColor" : "none"} />
        </IconButton>
      </div>

      <div className="px-4 pb-4">
        <p className="text-[15px] font-bold leading-snug">{title}</p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => {
              const now = triedStore.toggleDone(item.id);
              if (now) {
                trackContent(item.id, "complete");
                showToast(t("Nice work. Keep it up."));
              }
            }}
            aria-pressed={done}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-bold transition-transform active:scale-[0.98] ${
              done ? "bg-mint text-forest" : "bg-forest text-white"
            }`}
          >
            {done ? (
              <>
                <Check size={16} /> {t("Done. Do it again anytime")}
              </>
            ) : (
              t("I did it")
            )}
          </button>
          {spec.tool === "pelvic-floor" && (
            <Link
              href={contentHref(TIMER_ID)}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-full px-4 py-3 text-sm font-bold text-forest ring-1 ring-line"
            >
              <Timer size={16} /> {t("Timer")}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function IconButton({ label, pressed, onClick, children }: { label: string; pressed?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-full text-ink transition-transform active:scale-90"
    >
      {children}
    </button>
  );
}

/* ───────────── Carousel ───────────── */

function Carousel({ children, label, t }: { children: React.ReactNode[]; label: string; t: T }) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = children.length;

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }, []);
  const go = (i: number) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: Math.max(0, Math.min(count - 1, i)) * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="group relative" role="region" aria-roledescription="carousel" aria-label={label}>
      {/* overflow-x-auto also tells the tab pager to leave this swipe alone */}
      <div ref={ref} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
        {children.map((s, i) => (
          <div key={i} className="aspect-square w-full shrink-0 snap-center" aria-roledescription="slide" aria-label={`${i + 1} / ${count}`} aria-hidden={i !== index}>
            {s}
          </div>
        ))}
      </div>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold tabular-nums text-white backdrop-blur">
        {index + 1}/{count}
      </span>
      {/* Arrows for mouse users on a computer */}
      <button
        onClick={() => go(index - 1)}
        aria-label={t("Previous")}
        className={`absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow transition-opacity lg:flex ${index === 0 ? "pointer-events-none opacity-0" : "opacity-0 group-hover:opacity-100"}`}
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={() => go(index + 1)}
        aria-label={t("Next")}
        className={`absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow transition-opacity lg:flex ${index === count - 1 ? "pointer-events-none opacity-0" : "opacity-0 group-hover:opacity-100"}`}
      >
        <ChevronRight size={18} />
      </button>
      <div className="flex justify-center gap-1.5 pt-3" aria-hidden>
        {children.map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-forest" : "w-1.5 bg-line"}`} />
        ))}
      </div>
    </div>
  );
}

/* ───────────── Slides ───────────── */

function HookSlide({ item, spec, title, hook, first, t }: { item: ContentItem; spec: ActionSpec; title: string; hook: string; first: boolean; t: T }) {
  const steps = spec.steps.length;
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Cover item={item} className="absolute inset-0 h-full w-full" showPlay={false} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/5" />
      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <p className="text-[11px] font-bold uppercase tracking-wider text-mint-strong">{t(TYPE_LABEL[spec.type])}</p>
        <h3 className="mt-1.5 font-display text-[27px] font-bold leading-[1.1]">{title}</h3>
        <p className="mt-2 text-[15px] leading-snug text-white/85">{hook}</p>
        <p className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-white">
          <span className="inline-flex w-5 shrink-0 justify-center">
            <Hand size={15} className={first ? "swipe-hand" : ""} aria-hidden />
          </span>
          {t(steps === 1 ? "Swipe for the step" : "Swipe for {n} steps", { n: steps })}
        </p>
      </div>
    </div>
  );
}

function NeedSlide({ need, t }: { need: string[]; t: T }) {
  return (
    <div className="flex h-full w-full flex-col justify-center bg-mint px-6 py-8 text-forest-deep">
      <p className="text-[11px] font-bold uppercase tracking-wider text-forest">{t("You need")}</p>
      <ul className="mt-4 space-y-3">
        {need.map((n, i) => (
          <li key={i} className="flex items-start gap-3 text-[17px] font-semibold leading-snug">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest text-white">
              <Check size={14} />
            </span>
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepSlide({ n, total, title, text, t }: { n: number; total: number; title?: string; text: string; t: T }) {
  return (
    <div className="relative flex h-full w-full flex-col justify-center overflow-hidden bg-forest-deep px-6 py-8 text-white">
      <span className="pointer-events-none absolute -right-4 -top-10 font-display text-[200px] font-bold leading-none text-white/[0.07]" aria-hidden>
        {n}
      </span>
      <p className="text-[11px] font-bold uppercase tracking-wider text-mint-strong">{t("Step {n} of {total}", { n, total })}</p>
      {title && <p className="mt-3 font-display text-[26px] font-bold leading-tight">{title}</p>}
      <p className={`${title ? "mt-2 text-[17px]" : "mt-3 text-[21px] font-semibold"} leading-snug text-white/95`}>{text}</p>
    </div>
  );
}

function WhySlide({ why, t }: { why: string; t: T }) {
  return (
    <div className="flex h-full w-full flex-col justify-center bg-surface px-6 py-8">
      <p className="text-[11px] font-bold uppercase tracking-wider text-forest">{t("Why it works")}</p>
      <p className="mt-3 font-display text-[22px] font-bold leading-snug text-ink">{why}</p>
      <p className="mt-5 text-sm text-ink-soft">{t("Tried it? Tap \"I did it\" below.")}</p>
    </div>
  );
}
