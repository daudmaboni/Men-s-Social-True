// Combines what's on this phone with what's saved in his account, without losing either.
// Used when he signs in (e.g. guest progress + an account he made on another phone).
// Pure functions — easy to test.

import type { FeedDB } from "../feed/store";
import type { SocialDB } from "../social/store";
import type { Goal, TrackingRecord } from "../progress/types";

export type ProgressDB = { records: TrackingRecord[]; goals: Goal[] };

/** Keep one of each id; if both sides have it, keep the most recently changed. */
function byIdNewest<T extends { id: string }>(a: T[], b: T[], stamp: (x: T) => string): T[] {
  const map = new Map<string, T>();
  for (const x of [...a, ...b]) {
    const have = map.get(x.id);
    if (!have || stamp(x) > stamp(have)) map.set(x.id, x);
  }
  return [...map.values()];
}

export function mergeProgress(local: ProgressDB, remote: Partial<ProgressDB> | null, userId?: string): ProgressDB {
  const r = { records: remote?.records ?? [], goals: remote?.goals ?? [] };
  const records = byIdNewest(local.records, r.records, (x) => x.updatedAt ?? "")
    .map((x) => (userId ? { ...x, userId } : x))
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const goals = new Map<string, Goal>();
  for (const g of [...local.goals, ...r.goals]) {
    const have = goals.get(g.metric);
    if (!have || (g.updatedAt ?? "") > (have.updatedAt ?? "")) goals.set(g.metric, g);
  }
  return { records, goals: [...goals.values()] };
}

export function mergeFeed(local: FeedDB, remote: Partial<FeedDB> | null): FeedDB {
  const days: FeedDB["days"] = {};
  for (const src of [local.days, remote?.days ?? {}]) {
    for (const [day, choices] of Object.entries(src)) {
      days[day] = { ...days[day] };
      for (const [id, c] of Object.entries(choices)) {
        const have = days[day][id];
        if (!have || c.at > have.at) days[day][id] = c;
      }
    }
  }
  const lessons: FeedDB["lessons"] = { ...(remote?.lessons ?? {}) };
  for (const [id, l] of Object.entries(local.lessons)) {
    if (!lessons[id] || l.at < lessons[id].at) lessons[id] = l; // first time he read it
  }
  return {
    days,
    lessons,
    settings: { discreet: Boolean(local.settings.discreet || remote?.settings?.discreet) },
  };
}

export function mergeSocial(local: SocialDB, remote: Partial<SocialDB> | null): SocialDB {
  const r: SocialDB = { bookmarks: {}, interests: [], nickname: "", posts: [], replies: [], reactions: {}, reports: {}, history: {}, ...remote };
  const reactions: SocialDB["reactions"] = { ...r.reactions };
  for (const [id, kinds] of Object.entries(local.reactions)) reactions[id] = [...new Set([...(reactions[id] ?? []), ...kinds])];
  return {
    bookmarks: { ...r.bookmarks, ...local.bookmarks },
    interests: [...new Set([...r.interests, ...local.interests])],
    nickname: local.nickname || r.nickname,
    posts: byIdNewest(r.posts, local.posts, (p) => p.createdAt),
    replies: byIdNewest(r.replies, local.replies, (p) => p.createdAt),
    reactions,
    reports: { ...r.reports, ...local.reports },
    history: { ...r.history, ...local.history },
  };
}

/** Tanzanian phone numbers in any common format → +255XXXXXXXXX, or null if it isn't one. */
export function normalizeTzPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  const m = /^(?:\+?255|0)?([67]\d{8})$/.exec(digits);
  return m ? `+255${m[1]}` : null;
}
