"use client";

// Discover as a feed of things to DO, not things to read about.
// Top: "What are you dealing with?" circles, like Instagram stories. Below: one endless column of
// action cards. Each card is a carousel he swipes through: the hook, what he needs, the steps,
// why it works. Then: "Useful", share, save, and "I did it".

import { sized } from "@/lib/media/image";
import { CIRCLES, circlesOf } from "@/lib/content/circles";
import { haptic } from "@/lib/motion/haptics";
import { flyPoints } from "@/lib/motion/flyPoints";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BatteryCharging,
  BookOpen,
  Bookmark,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Hand,
  Heart,
  Layers,
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
import type { ActionResult, ActionSpec, ActionType, ChallengeId, ContentItem } from "@/lib/content/types";
import { socialStore, useSocial } from "@/lib/social/store";
import { TRIED_POINTS, triedStore, useTried, type FeedFilter } from "@/lib/social/tried";
import { helpedYes } from "@/lib/social/helped";
import { useFeed } from "@/lib/feed/store";
import HelpedCheck from "./HelpedCheck";
import { trackContent } from "@/lib/analytics/track";
import { youtubeId } from "@/lib/content/youtube";
import { YouTubeFrame } from "@/components/media/YouTubeFrame";
import { inviteToAccount } from "@/components/account/AccountInvite";
import { useT, type T } from "@/lib/i18n";
import { ReelPost, ReelsViewer } from "./Reels";
import { openKito } from "@/components/kito/KitoLauncher";
import KitoMark from "@/components/kito/KitoMark";
import { isReel } from "@/lib/content/reels";
import { hash, orderCards, orderReels, placeReels, reelEvery, type Habits } from "@/lib/content/discover";
import { challengeDates, dropCards, dropTimes, seriesOf, seriesOpen, seriesProgress } from "@/lib/content/hooks";
import { isCircle } from "@/lib/content/circles";
import { topicQueue } from "@/lib/content/reels";
import { useProgress } from "@/lib/progress/store";
import { useSaveData } from "@/lib/media/saveData";
import ListenButton from "./ListenButton";
import { dateKey, shiftKey } from "@/lib/progress/dates";
import { thenAndNow, THEN_NOW_EVERY_DAYS, type ThenNow } from "@/lib/progress/thenNow";
import { helpedShown, storyFor, useStories } from "@/lib/social/stories";
import { AskSlide, ChallengeButton, ChallengeStrip, DropBanner, LockedPart, NextPartSlide, ShareSheet, StoryCard, ThenNowCard, type SeriesInfo } from "./Hooks";
import { DISCOVER_REFRESH, habitsStore, useDiscoverConfig, visitSeed } from "@/lib/social/discoverPrefs";
import { useAccount } from "@/lib/account/useAccount";
import { useContentSw } from "@/lib/me/contentLang";

// The circles: names from the shared list (lib/content/circles.ts), so the Studio uses the very same ones (Step 80)
const ICON: Record<ChallengeId, typeof Timer> = { last: Timer, hard: Zap, her: Flame, mixes: Leaf, train: Dumbbell, reset: Brain, desire: BatteryCharging };
const CHALLENGES: { id: FeedFilter; label: string; icon: typeof Timer }[] = [
  { id: "all", label: "For you", icon: Sparkles },
  ...CIRCLES.map((c) => ({ id: c.id, label: c.label, icon: ICON[c.id] })),
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
      <div className="aspect-[5/4] animate-pulse rounded-[20px] bg-forest-deep/15 lg:mx-0" />
    </div>
  );
}

type Visit = {
  seed: string;
  done: Record<string, string>;
  /** card id → his date he did it (for series parts) */
  doneOn: Record<string, string>;
  opened: Record<string, string>;
  saved: Record<string, string>;
  habits: Habits;
  today: string;
  thenNow: ThenNow | null;
};

const THEN_NOW_KEY = "ms_then_now_seen";

/** Is it time for "You, then and now" (at most once a week; it stays for the rest of that day)? */
function thenNowDue(today: string): boolean {
  try {
    const seen = localStorage.getItem(THEN_NOW_KEY);
    if (seen === `x:${today}`) return false; // he closed it today
    return !seen || seen === today || seen < shiftKey(today, -THEN_NOW_EVERY_DAYS);
  } catch {
    return false;
  }
}
function thenNowMark(v: string) {
  try {
    localStorage.setItem(THEN_NOW_KEY, v);
  } catch {}
}

export default function ActionFeed() {
  const { items } = useLibrary();
  const feed = useFeed();
  const tried = useTried();
  const social = useSocial();
  const progress = useProgress();
  const { stories, counts } = useStories();
  const t = useT();
  const sw = useContentSw(); // Step 94: content language (Kiswahili by default)
  const [shown, setShown] = useState(PAGE);
  // Reels (Step 70): the order is fixed when the viewer opens, so it doesn't move while he watches
  const [viewer, setViewer] = useState<{ list: ContentItem[]; start: number; sound: boolean } | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const filter = tried.filter;
  const circle: ChallengeId | null = isCircle(filter) ? filter : null;

  const acc = useAccount();
  const cfg = useDiscoverConfig();
  const accountId = acc.status === "signedIn" ? acc.user.id : null;

  // Every "do this" card (built-in and from the Studio's Card maker)
  const all = useMemo<Card[]>(
    () =>
      items.flatMap((item) => {
        const spec = actionOf(item);
        return spec && item.status !== "archived" ? [{ item, spec }] : [];
      }),
    [items],
  );
  const seriesMap = useMemo(() => seriesOf(all), [all]);

  // Step 71: a new order every visit, different for each man. What he did, opened and his habits are
  // read once when the visit starts (or he changes the challenge), so nothing jumps while he scrolls.
  const [refreshes, setRefreshes] = useState(0);
  const [visit, setVisit] = useState<Visit | null>(null);
  useEffect(() => {
    if (!tried.ready || !social.ready || !progress.ready) return;
    const today = dateKey(new Date());
    const doneOn: Record<string, string> = {};
    for (const [id, at] of Object.entries(tried.done)) doneOn[id] = feed.tried?.[id]?.localDate ?? dateKey(new Date(at));
    // Step 86: "You, then and now", from his own records and what he did
    const doneDates = [...Object.values(doneOn), ...challengeDates(feed.challenges)];
    const tn = cfg.thenNow && thenNowDue(today) ? thenAndNow(progress.records, doneDates, today) : null;
    setVisit({ seed: visitSeed(accountId), done: { ...tried.done }, doneOn, opened: { ...social.history }, saved: { ...social.bookmarks }, habits: habitsStore.get(), today, thenNow: tn });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tried.ready, social.ready, progress.ready, filter, accountId, refreshes]);
  // Pull to refresh (Step 77) starts a new visit: a fresh order, from the top
  useEffect(() => {
    const on = () => {
      setShown(PAGE);
      setRefreshes((n) => n + 1);
    };
    window.addEventListener(DISCOVER_REFRESH, on);
    return () => window.removeEventListener(DISCOVER_REFRESH, on);
  }, []);

  const notHelped = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [id, x] of Object.entries(feed.tried ?? {})) if (x?.helped?.answer === "no") out[id] = x.helped.at;
    return out;
  }, [feed.tried]);

  // What this view shows (Step 86: his playbook and series too). Later parts of a series stay hidden until they open.
  const view = useMemo(() => {
    const empty = { cards: [] as Card[], locked: [] as { part: number; total: number; opensOn: string | null }[] };
    if (!visit) return empty;
    const open = (c: Card) => seriesOpen(c, seriesMap, visit.doneOn, visit.today, cfg.seriesWait);
    if (filter === "saved") {
      const saved = all.filter((c) => visit.saved[c.item.id]);
      saved.sort((a, b) => Number(Boolean(visit.done[a.item.id])) - Number(Boolean(visit.done[b.item.id])) || visit.saved[b.item.id].localeCompare(visit.saved[a.item.id]));
      return { ...empty, cards: saved };
    }
    if (filter.startsWith("series:")) {
      const s = seriesMap.get(filter.slice(7));
      if (!s) return empty;
      const cards = s.parts.filter(open);
      const pr = seriesProgress(s, visit.doneOn, visit.today, cfg.seriesWait);
      const locked = s.parts.filter((c) => !open(c)).map((c, i) => ({ part: c.spec.series!.part, total: s.parts.length, opensOn: i === 0 ? pr.opensOn : null }));
      return { cards, locked };
    }
    const picked = (filter === "all" ? all : all.filter((c) => circle && c.spec.challenges.includes(circle))).filter(open);
    const taste = {
      interests: social.interests,
      opened: visit.opened,
      liked: { ...helpedYes(feed.tried), ...tried.liked },
      done: visit.done,
      saved: visit.saved,
      notHelped,
      nextParts: new Set(
        [...seriesMap.values()].flatMap((s) => {
          const p = seriesProgress(s, visit.doneOn, visit.today, cfg.seriesWait);
          return p.started && p.next && !p.opensOn ? [p.next.item.id] : [];
        }),
      ),
    };
    return { ...empty, cards: orderCards(picked, `${visit.seed}:${filter}`, taste, cfg) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, filter, visit, cfg, seriesMap]);
  const cards = view.cards;
  const plain = filter === "all" || Boolean(circle);

  const reels = useMemo(() => (visit ? orderReels(items.filter(isReel), visit.seed, visit.opened, cfg) : []), [items, visit, cfg]);
  // Reels inside the feed: how often depends on the Studio setting and (if allowed) on his habits
  // Step 80: inside a circle, only the reels staff put in that circle
  const reelSpots = useMemo(() => {
    if (!visit || !plain) return new Map<number, ContentItem>();
    const here = filter === "all" ? reels : reels.filter((r) => circle && circlesOf(r).includes(circle));
    return placeReels(cards.length, here, reelEvery(cfg, visit.habits));
  }, [visit, filter, circle, plain, reels, cards.length, cfg]);

  // Step 86: the daily drop — Studio cards that went live since the last drop time, not opened yet
  const [now] = useState(() => new Date());
  const drop = useMemo(() => {
    if (!visit || filter !== "all") return { fresh: [] as Card[], next: null as Date | null };
    const fresh = dropCards(cards, cfg.dropAt || null, now).filter((c) => !visit.opened[c.item.id] && !visit.done[c.item.id]);
    return { fresh, next: cfg.dropAt ? (dropTimes(cfg.dropAt, now)?.next ?? null) : null };
  }, [visit, filter, cards, cfg.dropAt, now]);
  const goToDrop = useCallback(() => {
    const id = drop.fresh[0]?.item.id;
    if (id) document.querySelector(`[data-card="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [drop.fresh]);
  // Opened from the drop notification: straight to the new cards
  const dropLink = useRef(false);
  useEffect(() => {
    if (dropLink.current || !drop.fresh.length) return;
    if (!/[?&]drop=1/.test(location.search)) return;
    dropLink.current = true;
    requestAnimationFrame(goToDrop);
  }, [drop.fresh, goToDrop]);

  // Series he's in the middle of: circles at the top (Step 86)
  const seriesCircles = useMemo(() => {
    if (!visit) return [];
    return [...seriesMap.values()]
      .map((s) => ({ s, p: seriesProgress(s, visit.doneOn, visit.today, cfg.seriesWait) }))
      .filter((x) => x.p.started && !x.p.finished)
      .sort((a, b) => Number(Boolean(a.p.opensOn)) - Number(Boolean(b.p.opensOn)))
      .slice(0, 4);
  }, [seriesMap, visit, cfg.seriesWait]);

  const [thenNowOpen, setThenNowOpen] = useState(true);
  useEffect(() => {
    if (visit?.thenNow) thenNowMark(visit.today);
  }, [visit]);
  const seedNum = visit ? hash(visit.seed) % 997 : 0;

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

  // Tapping a reel opens the full-screen viewer with sound on. The tapped reel comes first, then more reels
  // on the same topic (Step 86), then the rest; pulling down on the first one closes the viewer (Step 77).
  const openReels = (start: number, list = reels) => setViewer({ list: topicQueue(list, start, (r) => circlesOf(r)), start: 0, sound: true });
  if (!tried.ready || !social.ready || !visit) return <ActionFeedSkeleton />;

  const left = (id: ChallengeId | "all") => (id === "all" ? all : all.filter((c) => c.spec.challenges.includes(id))).some((c) => !tried.done[c.item.id]);
  const savedCount = Object.keys(social.bookmarks).filter((id) => all.some((c) => c.item.id === id)).length;
  const circles: { id: FeedFilter; label: string; icon: typeof Timer; fresh: boolean; ring?: number }[] = [
    { ...CHALLENGES[0], fresh: left("all") },
    ...(savedCount ? [{ id: "saved" as FeedFilter, label: "My playbook", icon: BookOpen, fresh: false }] : []),
    ...seriesCircles.map(({ s, p }) => ({
      id: `series:${s.id}` as FeedFilter,
      label: sw ? s.nameSw : s.name,
      icon: Layers,
      fresh: !p.opensOn,
      ring: p.done / p.total,
    })),
    ...CHALLENGES.slice(1).map((c) => ({ ...c, fresh: left(c.id as ChallengeId) })),
  ];
  const current = circles.find((c) => c.id === filter) ?? circles[0];
  const helpedFor = (id: string) => helpedShown(counts[id], Boolean(tried.liked[id]), cfg.helpedMin);
  const seriesInfo = (c: Card): SeriesInfo | undefined => {
    const sp = c.spec.series;
    const s = sp && seriesMap.get(sp.id);
    if (!sp || !s) return undefined;
    const i = s.parts.findIndex((x) => x.item.id === c.item.id);
    const next = s.parts[i + 1];
    return {
      name: sw ? s.nameSw : s.name,
      part: i + 1,
      total: s.parts.length,
      tease: (sw ? sp.teaseSw : sp.tease) || (next ? (sw && next.item.titleSw ? next.item.titleSw : next.item.title) : undefined),
      wait: cfg.seriesWait,
      last: !next,
    };
  };

  return (
    <div className="mx-auto w-full max-w-[480px] space-y-4">
      <section aria-labelledby="challenge-h" className="-mx-1 scroll-mt-4 lg:mx-0" ref={top}>
        <h2 id="challenge-h" className="px-3.5 font-display text-[1.25rem] font-bold leading-tight lg:px-0">
          {t("What are you dealing with?")}
        </h2>
        <div role="tablist" aria-label={t("What are you dealing with?")} className="no-scrollbar mt-3 flex gap-3.5 overflow-x-auto px-3.5 pb-1 lg:px-0">
          {circles.map(({ id, label, icon: Icon, fresh, ring }) => {
            const on = filter === id;
            // The ring is coloured while there are cards here he hasn't tried yet; a series shows how far he is
            const bg =
              ring !== undefined
                ? { background: `conic-gradient(var(--honey) ${Math.round(ring * 360)}deg, var(--line) 0)` }
                : undefined;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={on}
                onClick={() => pick(id)}
                className="flex w-[74px] shrink-0 flex-col items-center gap-1.5 transition-transform active:scale-95"
              >
                <span
                  style={bg}
                  className={`rounded-full p-[2.5px] ${ring !== undefined ? "" : fresh ? "bg-[conic-gradient(from_200deg,var(--honey),var(--mint-strong),var(--forest),var(--honey))]" : "bg-line"}`}
                >
                  <span className="block rounded-full bg-bg p-[2.5px]">
                    <span
                      className={`flex h-[60px] w-[60px] items-center justify-center rounded-full transition-colors ${on ? "bg-forest text-white" : id === "saved" || ring !== undefined ? "bg-honey/20 text-forest ring-1 ring-line" : "bg-surface text-forest ring-1 ring-line"}`}
                    >
                      <Icon size={24} strokeWidth={2} aria-hidden />
                    </span>
                  </span>
                </span>
                <span className={`cap-xs line-clamp-2 text-center text-[0.6875rem] leading-tight ${on ? "font-bold text-ink" : "font-medium text-ink-soft"}`}>
                  {ring !== undefined ? label : t(label)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Kito lives here on a phone, so his floating button doesn't have to sit on the cards (Step 73) */}
      <button
        type="button"
        onClick={() => openKito()}
        data-kito-row
        className="flex w-full items-center gap-2.5 rounded-full bg-surface py-1 pl-1 pr-4 text-left ring-1 ring-line transition-transform active:scale-[0.98] lg:hidden"
      >
        <KitoMark size={36} />
        <span className="flex-1 truncate text-sm text-ink-soft">{t("Ask Kito…")}</span>
        <Send size={16} className="text-forest" aria-hidden />
      </button>

      {/* Step 86: today's drop, and the challenges he's doing */}
      {filter === "all" && <DropBanner fresh={drop.fresh.length} next={drop.next} onGo={goToDrop} t={t} />}
      <ChallengeStrip items={items} t={t} />

      {/* A few days after he did a card: did it help? (Step 79) */}
      <HelpedCheck items={items} />

      {filter !== "all" && (
        <p className="edge-pad flex items-center justify-between gap-2 text-xs text-ink-soft">
          <span>
            {filter === "saved"
              ? t("My playbook: {n} saved, {d} done", { n: cards.length, d: cards.filter((c) => tried.done[c.item.id]).length })
              : filter.startsWith("series:")
                ? t("{name}: {d} of {total} parts done", {
                    name: current.label,
                    d: cards.filter((c) => tried.done[c.item.id]).length,
                    total: cards.length + view.locked.length,
                  })
                : t("{n} things to try for: {challenge}", { n: cards.length, challenge: t(current.label).toLowerCase() })}
          </span>
          <button onClick={() => pick("all")} className="font-semibold text-forest">
            {t("Show all")}
          </button>
        </p>
      )}

      <div className="space-y-3 lg:mx-0 lg:space-y-4">
        {cards.slice(0, shown).map((c, i) => {
          // Reels between the cards: full width, the one on screen plays silently (each reel shows once)
          const r = reelSpots.get(i);
          // A real man's story every few cards (Step 86)
          const story = plain && cfg.storyEvery > 0 && i > 0 && i % cfg.storyEvery === 0 ? storyFor(stories, i / cfg.storyEvery - 1, circle, seedNum) : null;
          return (
            <Fragment key={`${filter}-${c.item.id}`}>
              {r && <ReelPost reel={r} onOpen={() => openReels(reels.indexOf(r))} />}
              {i === 2 && filter === "all" && visit.thenNow && thenNowOpen && (
                <ThenNowCard
                  data={visit.thenNow}
                  t={t}
                  onClose={() => {
                    setThenNowOpen(false);
                    thenNowMark(`x:${visit.today}`);
                  }}
                />
              )}
              {story && <StoryCard story={story} onCircle={(ch) => pick(ch)} t={t} />}
              <ActionPost
                card={c}
                first={i === 0}
                done={Boolean(tried.done[c.item.id])}
                liked={Boolean(tried.liked[c.item.id])}
                saved={Boolean(social.bookmarks[c.item.id])}
                helped={helpedFor(c.item.id)}
                series={seriesInfo(c)}
              />
            </Fragment>
          );
        })}
        {view.locked.map((l) => (
          <LockedPart key={l.part} part={l.part} total={l.total} opensOn={l.opensOn} t={t} />
        ))}
      </div>

      {more ? (
        <div ref={sentinel} className="h-[40vh] animate-pulse rounded-[20px] lg:mx-0 bg-surface ring-1 ring-line" aria-hidden />
      ) : (
        <EndOfFeed filter={filter} empty={cards.length === 0} onPick={pick} t={t} />
      )}
      {viewer && <ReelsViewer reels={viewer.list} start={viewer.start} withSound={viewer.sound} onClose={() => setViewer(null)} />}
    </div>
  );
}

function EndOfFeed({ filter, empty, onPick, t }: { filter: FeedFilter; empty: boolean; onPick: (id: FeedFilter) => void; t: T }) {
  if (filter === "saved" && empty) {
    return (
      <section className="rounded-[20px] bg-surface p-5 text-center ring-1 ring-line">
        <p className="font-display text-lg font-bold">{t("Your playbook is empty")}</p>
        <p className="mt-1 text-sm text-ink-soft">{t("Tap the bookmark on any card to keep it here, as your own plan.")}</p>
      </section>
    );
  }
  if (filter.startsWith("series:")) return null;
  return (
    <section className="rounded-[20px] bg-forest-deep p-5 text-center text-white">
      <p className="font-display text-xl font-bold">{t(filter === "saved" ? "That's your whole playbook" : "That's everything for now")}</p>
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

/** One card in the feed, Instagram-post style. Also used by the Studio's Card maker preview. */
export function ActionPost({
  card,
  first,
  done,
  liked,
  saved,
  helped = null,
  series,
}: {
  card: Card;
  first: boolean;
  done: boolean;
  liked: boolean;
  saved: boolean;
  /** "N men said this helped" (Step 86), or null to show nothing. */
  helped?: number | null;
  /** Where this card sits in its series (Step 86). */
  series?: SeriesInfo;
}) {
  const { item, spec } = card;
  const t = useT();
  const sw = useContentSw(); // Step 94: content language (Kiswahili by default)
  const showToast = useToast();
  const title = sw && item.titleSw ? item.titleSw : item.title;
  const hook = sw && item.summarySw ? item.summarySw : item.summary;
  const why = sw ? spec.whySw : spec.why;
  const need = sw ? spec.needSw : spec.need;
  const TypeIcon = TYPE_ICON[spec.type];
  const href = contentHref(item.id);
  const [sharing, setSharing] = useState(false);

  const slides: React.ReactNode[] = [
    // Step 86: a question first, when the card has one (the answer is one tap away)
    spec.ask ? (
      <AskSlide key="ask" ask={spec.ask} title={title} steps={spec.steps.length} t={t} onAnswer={habitsStore.cardUsed} />
    ) : (
      <HookSlide key="hook" item={item} spec={spec} title={title} hook={hook} first={first} t={t} />
    ),
    ...(item.videoUrl || item.audioUrl ? [<MediaSlide key="media" item={item} t={t} />] : []),
    ...(need?.length ? [<NeedSlide key="need" need={need} t={t} />] : []),
    ...spec.steps.map((s, i) => (
      <StepSlide key={`s${i}`} n={i + 1} total={spec.steps.length} title={sw ? s.titleSw : s.title} text={sw ? s.textSw : s.text} t={t} />
    )),
    ...(why ? [<WhySlide key="why" why={why} t={t} />] : []),
    ...(series ? [<NextPartSlide key="next" s={series} t={t} />] : []),
  ];

  return (
    <article data-card={item.id} className="scroll-mt-4 overflow-hidden rounded-[20px] bg-surface ring-1 ring-line" aria-label={title}>
      <header className="flex items-center gap-2.5 px-3 py-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint text-forest">
          <TypeIcon size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] font-bold leading-tight">{series ? series.name : t(TYPE_LABEL[spec.type])}</p>
          <p className="truncate text-[0.6875rem] text-ink-soft">
            {series ? `${t("Part {n} of {total}", { n: series.part, total: series.total })} · ` : ""}
            {t("{n} min", { n: item.minutes })} · @kayaniherbs
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-bold ${spec.results === "tonight" ? "bg-honey text-on-honey" : "bg-mint text-forest"}`}
        >
          {t(RESULT_LABEL[spec.results])}
        </span>
      </header>

      <Carousel label={title} t={t} onSwipe={habitsStore.cardUsed}>
        {slides}
      </Carousel>

      <div className="flex items-center px-1">
        <IconButton
          label={t(liked ? "Helped ✓" : "This helped")}
          pressed={liked}
          onClick={() => {
            const now = triedStore.toggleLike(item.id);
            habitsStore.cardUsed();
            if (now) showToast(t("Glad it helped"));
          }}
        >
          <Heart size={22} className={liked ? "text-red-500" : ""} fill={liked ? "currentColor" : "none"} />
        </IconButton>
        <IconButton label={t("Share")} onClick={() => setSharing(true)}>
          <Send size={21} />
        </IconButton>
        {/* Step 90: hear it, or ask Kito about this card */}
        <ListenButton item={item} spec={spec} />
        <IconButton label={t("Ask Kito about this")} onClick={() => openKito({ id: item.id, title })}>
          <KitoMark size={26} />
        </IconButton>
        <Link href={href} className="ml-0.5 flex items-center gap-1 rounded-full px-1.5 py-2 text-xs font-semibold text-ink-soft">
          {t("Full page")} <ArrowRight size={13} />
        </Link>
        <span className="flex-1" />
        <IconButton
          label={t(saved ? "Remove from saved" : "Save for later")}
          pressed={saved}
          onClick={() => {
            const now = socialStore.toggleBookmark(item.id);
            habitsStore.cardUsed();
            if (now) trackContent(item.id, "save");
            showToast(t(now ? "Saved to your playbook" : "Removed from your playbook"));
            if (now) inviteToAccount("first-save");
          }}
        >
          <Bookmark size={21} fill={saved ? "currentColor" : "none"} />
        </IconButton>
      </div>

      <div className="px-3 pb-3">
        {helped !== null && (
          <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-ink-soft">
            <Heart size={12} className="text-red-500" fill="currentColor" aria-hidden /> {t(helped === 1 ? "1 man said this helped" : "{n} men said this helped", { n: helped })}
          </p>
        )}
        <p className="line-clamp-2 text-[0.875rem] font-bold leading-snug">{title}</p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={(e) => {
              const now = triedStore.toggleDone(item.id, done);
              habitsStore.cardUsed();
              if (now) {
                haptic("done");
                flyPoints(e.currentTarget, TRIED_POINTS); // Step 79: doing a card earns points
                trackContent(item.id, "complete");
                showToast(
                  !series
                    ? t("Nice one, bro. Keep going.")
                    : series.last
                      ? t("Series finished. Respect.")
                      : t(series.wait ? "Part {n} opens tomorrow." : "Part {n} is open now.", { n: series.part + 1 }),
                );
              }
            }}
            aria-pressed={done}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition-transform active:scale-[0.98] ${
              done ? "bg-mint text-forest" : "bg-forest text-white"
            }`}
          >
            {done ? (
              <>
                <Check size={16} /> {t("Done. Do it again anytime")}
              </>
            ) : (
              <>
                {t("I did it")} <span className="rounded-full bg-honey px-1.5 py-px text-[0.6875rem] font-bold text-on-honey">+{TRIED_POINTS}</span>
              </>
            )}
          </button>
          {spec.challengeDays && <ChallengeButton item={item} days={spec.challengeDays} t={t} />}
          {spec.tool === "pelvic-floor" && !spec.challengeDays && (
            <Link
              href={contentHref(TIMER_ID)}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold text-forest ring-1 ring-line"
            >
              <Timer size={16} /> {t("Timer")}
            </Link>
          )}
        </div>
      </div>
      <ShareSheet open={sharing} onClose={() => setSharing(false)} item={item} spec={spec} t={t} />
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
      className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-transform active:scale-90"
    >
      {children}
    </button>
  );
}

/* ───────────── Carousel ───────────── */

function Carousel({ children, label, t, onSwipe }: { children: React.ReactNode[]; label: string; t: T; onSwipe?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const swiped = useRef(false);
  const count = children.length;

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setIndex(i);
    // The first time he swipes into the steps, it counts as using the card (Step 71: reading vs reels)
    if (i > 0 && !swiped.current) {
      swiped.current = true;
      onSwipe?.();
    }
  }, [onSwipe]);
  const go = (i: number) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: Math.max(0, Math.min(count - 1, i)) * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="group relative" role="region" aria-roledescription="carousel" aria-label={label}>
      {/* overflow-x-auto also tells the tab pager to leave this swipe alone */}
      <div ref={ref} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
        {children.map((s, i) => (
          <div key={i} className="aspect-[5/4] w-full shrink-0 snap-center" aria-roledescription="slide" aria-label={`${i + 1} / ${count}`} aria-hidden={i !== index}>
            {s}
          </div>
        ))}
      </div>
      <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-full bg-black/45 px-2 py-0.5 text-[0.6875rem] font-bold tabular-nums text-white backdrop-blur">
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
      <div className="flex justify-center gap-1.5 pt-2" aria-hidden>
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
  // Step 90: with Save data on, the card opens on its words over a drawn background, not a photo
  const lite = useSaveData();
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Cover item={lite ? { ...item, coverImageUrl: undefined } : item} className="absolute inset-0 h-full w-full" showPlay={false} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/5" />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-3.5 text-white">
        <h3 className="line-clamp-3 font-display text-[1.4375rem] font-bold leading-[1.1]">{title}</h3>
        <p className="mt-1.5 line-clamp-2 text-[0.875rem] leading-snug text-white/85">{hook}</p>
        <p className="mt-2.5 flex items-center gap-1.5 text-[0.8125rem] font-semibold text-white">
          <span className="inline-flex w-5 shrink-0 justify-center">
            <Hand size={15} className={first ? "swipe-hand" : ""} aria-hidden />
          </span>
          {t(steps === 1 ? "Swipe for the step" : "Swipe for {n} steps", { n: steps })}
        </p>
      </div>
    </div>
  );
}

function MediaSlide({ item, t }: { item: ContentItem; t: T }) {
  const yt = youtubeId(item.videoUrl);
  if (yt) return <YouTubeFrame id={yt} controls title={item.title} onEnded={() => trackContent(item.id, "complete")} className="h-full w-full" />;
  if (item.videoUrl) {
    return (
      <video
        src={item.videoUrl}
        poster={item.coverImageUrl ? sized(item.coverImageUrl, 720) : undefined}
        controls
        playsInline
        preload="metadata"
        onEnded={() => trackContent(item.id, "complete")}
        // Step 92: the whole video, in its own shape (wide or upright), never zoomed in
        className="h-full w-full bg-black object-contain"
      />
    );
  }
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Cover item={item} className="absolute inset-0 h-full w-full" showPlay={false} />
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
        <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-wider text-mint-strong">{t("Listen")}</p>
        <audio src={item.audioUrl} controls preload="metadata" onEnded={() => trackContent(item.id, "complete")} className="w-full" />
      </div>
    </div>
  );
}

/** A text slide: the words sit in the middle, and long text scrolls instead of being cut off. */
function Frame({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div className={`relative flex h-full w-full flex-col overflow-y-auto overflow-x-hidden px-5 py-4 ${className}`}>
      <div className="relative my-auto">{children}</div>
    </div>
  );
}

function NeedSlide({ need, t }: { need: string[]; t: T }) {
  return (
    <Frame className="bg-mint text-forest-deep">
      <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-forest">{t("You need")}</p>
      <ul className={`mt-3 ${need.length > 4 ? "space-y-1.5" : "space-y-2.5"}`}>
        {need.map((n, i) => (
          <li key={i} className={`flex items-start gap-2.5 font-semibold leading-snug ${need.length > 4 ? "text-[0.875rem]" : "text-[1rem]"}`}>
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest text-white">
              <Check size={12} />
            </span>
            {n}
          </li>
        ))}
      </ul>
    </Frame>
  );
}

function StepSlide({ n, total, title, text, t }: { n: number; total: number; title?: string; text: string; t: T }) {
  const long = text.length > 120;
  return (
    <div className="relative h-full w-full overflow-hidden bg-forest-deep text-white">
      <span className="pointer-events-none absolute -right-3 -top-8 font-display text-[10rem] font-bold leading-none text-white/[0.07]" aria-hidden>
        {n}
      </span>
      <Frame className="">
        <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-mint-strong">{t("Step {n} of {total}", { n, total })}</p>
        {title && <p className="mt-2 font-display text-[1.3125rem] font-bold leading-tight">{title}</p>}
        <p className={`${title ? `mt-1.5 ${long ? "text-[0.9375rem]" : "text-[1rem]"}` : `mt-2 font-semibold ${long ? "text-[1rem]" : "text-[1.1875rem]"}`} leading-snug text-white/95`}>{text}</p>
      </Frame>
    </div>
  );
}

function WhySlide({ why, t }: { why: string; t: T }) {
  return (
    <Frame className="bg-surface">
      <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-forest">{t("The secret")}</p>
      <p className={`mt-2 font-display font-bold leading-snug text-ink ${why.length > 110 ? "text-[1.0625rem]" : "text-[1.1875rem]"}`}>{why}</p>
      <p className="mt-3 text-[0.8125rem] text-ink-soft">{t("Tried it? Tap \"I did it\" below.")}</p>
    </Frame>
  );
}
