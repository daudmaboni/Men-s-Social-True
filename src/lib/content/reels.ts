// Reels (Step 70): short vertical videos on Discover, like Instagram Reels. Pure, so it's tested.
//  - Which videos are reels, and in what order: new ones (not watched yet) first, newest first;
//    ones he already watched go to the end.
//  - The "soft end": after 15 reels in one go — or after 3 when it's late (22:00–05:00) — a card says
//    "that's enough for tonight", with "Keep watching" under it. The feed is never truly endless.

import type { ContentItem } from "./types";

/** Videos shown as reels: items made as reels in the Studio, plus "do this" cards that have a video. */
export function isReel(c: ContentItem): boolean {
  return Boolean(c.videoUrl) && c.status !== "archived" && (c.kind === "reel" || Boolean(c.action));
}

/** The caption under a reel, without repeating the title (a quick reel's caption starts with its title). */
export function reelCaption(reel: Pick<ContentItem, "title" | "titleSw" | "summary" | "summarySw">, sw: boolean): string {
  const text = ((sw ? reel.summarySw || reel.summary : reel.summary) ?? "").trim();
  const title = ((sw ? reel.titleSw || reel.title : reel.title) ?? "").trim();
  return title && text.startsWith(title) ? text.slice(title.length).replace(/^[\s.,:;–-]+/, "") : text;
}

export function reelOrder(items: ContentItem[], seen: Record<string, string>): ContentItem[] {
  const reels = items.filter(isReel);
  const newest = (a: ContentItem, b: ContentItem) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || b.priority - a.priority;
  return [...reels.filter((r) => !seen[r.id]).sort(newest), ...reels.filter((r) => seen[r.id]).sort((a, b) => seen[a.id].localeCompare(seen[b.id]))];
}

export const SOFT_END_DAY = 15;
export const SOFT_END_NIGHT = 3;

/** Late at night (22:00–05:00 on his phone)? */
export const isLate = (d: Date) => d.getHours() >= 22 || d.getHours() < 5;

/** After how many reels (counted from where he started) the "enough for tonight" card comes. */
export function softEndAfter(now: Date): number {
  return isLate(now) ? SOFT_END_NIGHT : SOFT_END_DAY;
}

/** Where to put the soft-end card in the list, or -1 when it doesn't fit (he'll reach the real end first). */
export function softEndIndex(start: number, total: number, now: Date): number {
  const at = start + softEndAfter(now);
  return at < total ? at : -1;
}

/** Step 86: the viewer's queue when he taps a reel. That reel first, then other reels in the same circle(s)
 *  (one interest becomes a session), then everything else in the feed's order. */
export function topicQueue(reels: ContentItem[], start: number, circlesOf: (r: ContentItem) => string[]): ContentItem[] {
  const first = reels[start];
  if (!first) return reels;
  const mine = new Set(circlesOf(first));
  const rest = [...reels.slice(start + 1), ...reels.slice(0, start)];
  const same = mine.size ? rest.filter((r) => circlesOf(r).some((c) => mine.has(c))) : [];
  const other = rest.filter((r) => !same.includes(r));
  return [first, ...same, ...other];
}
