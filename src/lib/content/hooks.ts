// What makes Discover pull a man back (Step 86). Pure, so it's tested.
//  - Series: cards in parts ("Part 2 of 5"). Part 1 is always on Discover; each next part opens the day
//    after he did the one before (or straight away, if the Studio turns the wait off).
//  - Challenges: "try it for 3/5/7 days". Missed days never fail him: it's done when he has done it N days.
//  - The daily drop: new cards go live at one time every evening (Studio → Discover).
//  - Sharing: a plain title, so nothing private shows on a friend's lock screen.

import { shiftKey } from "../progress/dates";
import type { ActionSpec, ContentItem } from "./types";

export type HookCard = { item: ContentItem; spec: ActionSpec };

/* ───────── Series ───────── */
export interface Series {
  id: string;
  name: string;
  nameSw: string;
  /** Its parts, in order (part 1 first). */
  parts: HookCard[];
}

/** Every series on Discover, from the cards that have one. Duplicate part numbers keep the newest card. */
export function seriesOf(cards: HookCard[]): Map<string, Series> {
  const out = new Map<string, Series>();
  for (const c of cards) {
    const s = c.spec.series;
    if (!s) continue;
    const have = out.get(s.id) ?? { id: s.id, name: s.name, nameSw: s.nameSw, parts: [] };
    const same = have.parts.findIndex((p) => p.spec.series!.part === s.part);
    if (same >= 0) {
      if ((c.item.publishedAt ?? "") >= (have.parts[same].item.publishedAt ?? "")) have.parts[same] = c;
    } else have.parts.push(c);
    out.set(s.id, have);
  }
  for (const s of out.values()) s.parts.sort((a, b) => a.spec.series!.part - b.spec.series!.part);
  return out;
}

export interface SeriesProgress {
  done: number;
  total: number;
  /** The next part to do (open now, or opening on `opensOn`), or null when he's finished. */
  next: HookCard | null;
  /** When `next` opens (his date), or null if it's open now. */
  opensOn: string | null;
  finished: boolean;
  started: boolean;
}

/** Where he is in a series. `doneOn`: card id → his date he did it. */
export function seriesProgress(s: Series, doneOn: Record<string, string>, today: string, wait = true): SeriesProgress {
  const total = s.parts.length;
  const done = s.parts.filter((p) => doneOn[p.item.id]).length;
  const i = s.parts.findIndex((p) => !doneOn[p.item.id]);
  const next = i < 0 ? null : s.parts[i];
  let opensOn: string | null = null;
  if (next && i > 0 && wait) {
    const before = doneOn[s.parts[i - 1].item.id];
    if (before && before >= today) opensOn = shiftKey(before, 1);
  }
  return { done, total, next, opensOn, finished: !next, started: done > 0 };
}

/** Is this card open to him yet? Part 1 and cards outside a series always are. A later part opens once he
 *  did the part before (the next day, when the Studio wants him to wait). Parts he did stay open. */
export function seriesOpen(c: HookCard, all: Map<string, Series>, doneOn: Record<string, string>, today: string, wait = true): boolean {
  const s = c.spec.series;
  if (!s || doneOn[c.item.id]) return true;
  const series = all.get(s.id);
  if (!series) return true;
  const i = series.parts.findIndex((p) => p.item.id === c.item.id);
  if (i <= 0) return true;
  const before = doneOn[series.parts[i - 1].item.id];
  if (!before) return false;
  return !wait || before < today;
}

/* ───────── Challenges ───────── */
export const CHALLENGE_DAY_POINTS = 5;
export const CHALLENGE_DONE_POINTS = 30;
/** A challenge he started this long ago and left is put away (he can start it again). */
export const CHALLENGE_STALE_DAYS = 21;

export interface ChallengeEntry {
  /** His date he started, and when. */
  start: string;
  at: string;
  /** How many days it asks for. */
  length: number;
  /** His dates he did it → when. */
  days: Record<string, string>;
  /** When he did the last day (and the points for finishing). */
  finished?: { localDate: string; at: string; points: number };
}

export interface ChallengeState {
  /** Which day of the challenge it is today (1 = the day he started), not more than `length`. */
  day: number;
  done: number;
  length: number;
  doneToday: boolean;
  finished: boolean;
  /** Started long ago and not touched: don't show it at the top any more. */
  stale: boolean;
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);

export function challengeState(e: ChallengeEntry, today: string): ChallengeState {
  const dates = Object.keys(e.days ?? {}).sort();
  const done = Math.min(dates.length, e.length);
  const last = dates[dates.length - 1] ?? e.start;
  return {
    day: Math.min(e.length, Math.max(1, daysBetween(e.start, today) + 1)),
    done,
    length: e.length,
    doneToday: Boolean(e.days?.[today]),
    finished: Boolean(e.finished) || done >= e.length,
    stale: !e.finished && daysBetween(last, today) > CHALLENGE_STALE_DAYS,
  };
}

/** Points from challenges on one of his dates: each day he did it, plus the finish. */
export function challengePoints(challenges: Record<string, ChallengeEntry> | undefined, key: string): number {
  let n = 0;
  for (const e of Object.values(challenges ?? {})) {
    if (!e || typeof e !== "object") continue;
    if (e.days?.[key]) n += CHALLENGE_DAY_POINTS;
    if (e.finished?.localDate === key) n += Math.max(0, e.finished.points || 0);
  }
  return n;
}

/** The dates he did something in a challenge (for streaks and "active days"). */
export function challengeDates(challenges: Record<string, ChallengeEntry> | undefined): string[] {
  return Object.values(challenges ?? {}).flatMap((e) => (e && typeof e === "object" ? Object.keys(e.days ?? {}) : []));
}

/* ───────── The daily drop ───────── */
/** "20:00" → minutes after midnight, or null if it isn't a time. */
export function dropMinutes(at: string | null | undefined): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(at ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** The last drop time that has passed, and the next one, as Dates on his phone's clock. */
export function dropTimes(at: string, now: Date): { last: Date; next: Date } | null {
  const m = dropMinutes(at);
  if (m === null) return null;
  const today = new Date(now);
  today.setHours(Math.floor(m / 60), m % 60, 0, 0);
  if (today <= now) return { last: today, next: new Date(today.getTime() + 864e5) };
  return { last: new Date(today.getTime() - 864e5), next: today };
}

/** The newest cards from today's drop: Studio cards that went live since the last drop time (or in the
 *  last 24 hours when there's no drop time). */
export function dropCards<T extends HookCard>(cards: T[], at: string | null, now: Date): T[] {
  const times = at ? dropTimes(at, now) : null;
  const since = times ? times.last.getTime() - 60 * 60_000 : now.getTime() - 864e5; // an hour early: staff publish just before
  return cards
    .filter((c) => !c.item.builtIn && c.item.publishedAt && Date.parse(c.item.publishedAt) >= since && Date.parse(c.item.publishedAt) <= now.getTime())
    .sort((a, b) => (b.item.publishedAt ?? "").localeCompare(a.item.publishedAt ?? ""));
}

/** "in 3 h 20 min" / "in 45 min", for the next drop. */
export function untilText(ms: number, sw: boolean): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (sw) return h ? `baada ya saa ${h}${m ? ` na dakika ${m}` : ""}` : `baada ya dakika ${m}`;
  return h ? `in ${h} h${m ? ` ${m} min` : ""}` : `in ${m} min`;
}

/* ───────── Sharing ───────── */
export const SAFE_SHARE = { en: "Something useful for men's health", sw: "Kitu muhimu kwa afya ya mwanaume" };

/** What goes into WhatsApp: a plain line and the link. Never the card's own title unless staff wrote a safe one. */
export function shareText(spec: Pick<ActionSpec, "shareTitle" | "shareTitleSw"> | undefined, url: string, sw: boolean): string {
  const title = (sw ? spec?.shareTitleSw || spec?.shareTitle : spec?.shareTitle || spec?.shareTitleSw) || (sw ? SAFE_SHARE.sw : SAFE_SHARE.en);
  return `${title} 👉 ${url}`;
}

export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
