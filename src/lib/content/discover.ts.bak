// How Discover is put together for each man (Step 71). Pure, so it's tested.
//
// 1. Cards change every visit, and differ from man to man. The order is a shuffle seeded by
//    his phone/account + this visit, weighted toward what fits him (cards he hasn't opened, the
//    topics he follows, the challenges he found useful). Within one visit the order stays put,
//    so cards never jump under his thumb. Pinned cards (Studio → Discover) stay at the top;
//    brand-new Studio cards come right after. Cards he already did go to the end.
//    No three cards of the same kind in a row.
// 2. Reels vs reading. By default one reel after every N cards (Studio sets N, 6 at first).
//    When "adapt to each man" is on and he has used Discover enough, the mix follows him:
//    a man who finishes reels gets them a bit more often (never more than one reel per 3 cards),
//    a man who reads and does the cards gets fewer. Never zero, never all reels.

import type { ActionSpec, ContentItem, TopicId } from "./types";

export interface DiscoverConfig {
  /** One reel after every this many cards (3–12). */
  reelEvery: number;
  /** Let each man's habits move the mix (within the limits). */
  adaptive: boolean;
  /** Shuffle the cards per visit. Off = the same order for everyone (pins and new cards still first). */
  shuffle: boolean;
  /** Card or reel ids pinned to the top, in order. */
  pinned: string[];
  /** Card or reel ids taken off Discover (they still open from links, search and Saved). */
  hidden: string[];
}

export const DEFAULT_DISCOVER: DiscoverConfig = { reelEvery: 6, adaptive: true, shuffle: true, pinned: [], hidden: [] };
export const REEL_EVERY_MIN = 3;
export const REEL_EVERY_MAX = 12;

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length < 200).slice(0, 200) : []);

/** A safe config from whatever the database holds. */
export function normalizeDiscover(v: unknown): DiscoverConfig {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const n = Math.round(Number(o.reelEvery));
  return {
    reelEvery: Number.isFinite(n) ? Math.min(REEL_EVERY_MAX, Math.max(REEL_EVERY_MIN, n)) : DEFAULT_DISCOVER.reelEvery,
    adaptive: o.adaptive !== false,
    shuffle: o.shuffle !== false,
    pinned: ids(o.pinned),
    hidden: ids(o.hidden),
  };
}

/* ───────── Seeded randomness (same seed → same order) ───────── */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** A number from 0 to 1 for this item in this visit. */
export const rand = (seed: string, id: string) => hash(`${seed}:${id}`) / 4294967296;

/* ───────── Cards ───────── */
export interface FeedCard {
  item: ContentItem;
  spec: ActionSpec;
}

export interface Taste {
  /** Topics he follows. */
  interests: TopicId[];
  /** contentId → when he opened it. */
  opened: Record<string, string>;
  /** contentId → when he marked it useful. */
  liked: Record<string, string>;
  /** contentId → when he tapped "I did it" (fixed when the visit starts). */
  done: Record<string, string>;
}

/** How well a card fits him: higher comes earlier. Part chance (changes each visit), part fit. */
export function cardScore(c: FeedCard, seed: string, taste: Taste, likedChallenges: Set<string>): number {
  let s = rand(seed, c.item.id);
  if (!taste.opened[c.item.id]) s += 0.6; // new to him
  if (taste.interests.includes(c.item.topic)) s += 0.35;
  if (c.spec.challenges.some((ch) => likedChallenges.has(ch))) s += 0.25;
  if (c.spec.results === "tonight") s += 0.1;
  return s;
}

/** Spread the kinds out: never three of the same kind in a row when there's another choice. */
export function spreadKinds(cards: FeedCard[]): FeedCard[] {
  const rest = [...cards];
  const out: FeedCard[] = [];
  while (rest.length) {
    const n = out.length;
    const blocked = n >= 2 && out[n - 1].spec.type === out[n - 2].spec.type ? out[n - 1].spec.type : null;
    const i = blocked ? rest.findIndex((c) => c.spec.type !== blocked) : 0;
    out.push(...rest.splice(i < 0 ? 0 : i, 1));
  }
  return out;
}

/** The order of the cards for this visit. */
export function orderCards(cards: FeedCard[], seed: string, taste: Taste, cfg: DiscoverConfig, now = Date.now()): FeedCard[] {
  const hidden = new Set(cfg.hidden);
  const shown = cards.filter((c) => !hidden.has(c.item.id));
  const pinnedOrder = new Map(cfg.pinned.map((id, i) => [id, i]));
  const pinned = shown.filter((c) => pinnedOrder.has(c.item.id)).sort((a, b) => pinnedOrder.get(a.item.id)! - pinnedOrder.get(b.item.id)!);
  // New Studio cards (last 7 days) right after the pins, newest first, until he's done them
  const week = now - 7 * 864e5;
  const fresh = shown
    .filter((c) => !pinnedOrder.has(c.item.id) && !c.item.builtIn && !taste.done[c.item.id] && c.item.publishedAt && Date.parse(c.item.publishedAt) > week)
    .sort((a, b) => (b.item.publishedAt ?? "").localeCompare(a.item.publishedAt ?? ""));
  const taken = new Set([...pinned, ...fresh].map((c) => c.item.id));
  const others = shown.filter((c) => !taken.has(c.item.id));

  const likedChallenges = new Set(cards.filter((c) => taste.liked[c.item.id] || taste.done[c.item.id]).flatMap((c) => c.spec.challenges));
  const todo = others.filter((c) => !taste.done[c.item.id]);
  const did = others.filter((c) => taste.done[c.item.id]);
  const ranked = cfg.shuffle
    ? [...todo].sort((a, b) => cardScore(b, seed, taste, likedChallenges) - cardScore(a, seed, taste, likedChallenges))
    : todo;
  const didOrder = cfg.shuffle ? [...did].sort((a, b) => rand(seed, a.item.id) - rand(seed, b.item.id)) : did;
  return [...pinned, ...fresh, ...spreadKinds(ranked), ...didOrder];
}

/* ───────── Reels in the feed ───────── */
export interface Habits {
  reelViews: number;
  /** Reels he watched to the end (or most of the way). */
  reelFinished: number;
  /** Reels he swiped away within 3 seconds. */
  reelSkipped: number;
  /** Cards he swiped through, opened, saved or did. */
  cardActions: number;
}
export const NO_HABITS: Habits = { reelViews: 0, reelFinished: 0, reelSkipped: 0, cardActions: 0 };

/** Enough use of Discover to read his habits. */
export const ENOUGH = 12;

/** After how many cards a reel comes, for this man. */
export function reelEvery(cfg: DiscoverConfig, h: Habits): number {
  const base = cfg.reelEvery;
  if (!cfg.adaptive) return base;
  const reels = h.reelFinished + h.reelViews * 0.3 - h.reelSkipped * 0.5;
  const total = Math.max(0, reels) + h.cardActions;
  if (h.reelViews + h.cardActions < ENOUGH || total <= 0) return base;
  const share = Math.max(0, reels) / total; // 0 = only reads, 1 = only watches
  // From base+4 (reader) down to base−3 (watcher), always between 3 and 12
  const n = Math.round(base + 4 - share * 7);
  return Math.min(REEL_EVERY_MAX, Math.max(REEL_EVERY_MIN, n));
}

/** Reels in the order he'll meet them in this visit: new ones first, shuffled per visit; watched ones last. */
export function orderReels(reels: ContentItem[], seed: string, seen: Record<string, string>, cfg: DiscoverConfig): ContentItem[] {
  const hidden = new Set(cfg.hidden);
  const shown = reels.filter((r) => !hidden.has(r.id));
  const pinnedOrder = new Map(cfg.pinned.map((id, i) => [id, i]));
  const pinned = shown.filter((r) => pinnedOrder.has(r.id)).sort((a, b) => pinnedOrder.get(a.id)! - pinnedOrder.get(b.id)!);
  const rest = shown.filter((r) => !pinnedOrder.has(r.id));
  const by = (a: ContentItem, b: ContentItem) => (cfg.shuffle ? rand(seed, a.id) - rand(seed, b.id) : (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return [...pinned, ...rest.filter((r) => !seen[r.id]).sort(by), ...rest.filter((r) => seen[r.id]).sort(by)];
}

/** Where each reel goes in the feed: index of the card it comes after → the reel. Each reel shows once. */
export function placeReels(cardCount: number, reels: ContentItem[], every: number): Map<number, ContentItem> {
  const at = new Map<number, ContentItem>();
  let r = 0;
  for (let i = every; i <= cardCount && r < reels.length; i += every) at.set(i, reels[r++]);
  return at;
}
