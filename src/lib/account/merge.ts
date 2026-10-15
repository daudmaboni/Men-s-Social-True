// Combines what's on this phone with what's saved in his account, without losing either.
// Used when he signs in (e.g. guest progress + an account he made on another phone).
// Pure functions — easy to test.

import type { FeedDB } from "../feed/store";
import type { SocialDB } from "../social/store";
import { cleanProfile, newestProfile } from "../me/profile";
import type { Goal, TrackingRecord } from "../progress/types";
import { isDeleted, mergeTombstones, type Tombstones } from "./tombstones";

// Deletions win over older copies: see tombstones.ts.
// Every merge gives the same result in the same order whichever side is "local",
// so two phones settle on the same data instead of saving back and forth.

export type ProgressDB = { records: TrackingRecord[]; goals: Goal[]; deleted?: Tombstones };

/** Keep one of each id; if both sides have it, keep the most recently changed. */
function byIdNewest<T extends { id: string }>(a: T[], b: T[], stamp: (x: T) => string): T[] {
  const map = new Map<string, T>();
  for (const x of [...a, ...b]) {
    const have = map.get(x.id);
    if (!have || stamp(x) > stamp(have)) map.set(x.id, x);
  }
  return [...map.values()];
}

/** Both sides' entries; for the same key keep the newest time. */
function newestTimes(a: Record<string, string> | undefined, b: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const src of [a ?? {}, b ?? {}]) {
    for (const [k, at] of Object.entries(src)) if (!out[k] || at > out[k]) out[k] = at;
  }
  return out;
}

const byTimeThenId = (t: (x: { id: string }) => string) => (a: { id: string }, b: { id: string }) =>
  t(a).localeCompare(t(b)) || a.id.localeCompare(b.id);

export function mergeProgress(local: ProgressDB, remote: Partial<ProgressDB> | null, userId?: string, now: Date = new Date()): ProgressDB {
  const r = { records: remote?.records ?? [], goals: remote?.goals ?? [] };
  const deleted = mergeTombstones(local.deleted, remote?.deleted, now);
  const records = byIdNewest(local.records, r.records, (x) => x.updatedAt ?? "")
    .filter((x) => !isDeleted(deleted, `rec:${x.id}`, x.updatedAt))
    .map((x) => (userId ? { ...x, userId } : x))
    .sort(byTimeThenId((x) => (x as TrackingRecord).recordedAt));
  const goals = new Map<string, Goal>();
  for (const g of [...local.goals, ...r.goals]) {
    const have = goals.get(g.metric);
    if (!have || (g.updatedAt ?? "") > (have.updatedAt ?? "")) goals.set(g.metric, g);
  }
  return { records, goals: [...goals.values()].sort((a, b) => a.metric.localeCompare(b.metric)), deleted };
}

export function mergeFeed(local: FeedDB, remote: Partial<FeedDB> | null, now: Date = new Date()): FeedDB {
  const deleted = mergeTombstones(local.deleted, remote?.deleted, now);
  const days: FeedDB["days"] = {};
  for (const src of [local.days, remote?.days ?? {}]) {
    for (const [day, choices] of Object.entries(src)) {
      for (const [id, c] of Object.entries(choices ?? {})) {
        if (isDeleted(deleted, `choice:${day}:${id}`, c.at)) continue; // he pressed Undo after this
        const have = days[day]?.[id];
        if (!have || c.at > have.at) days[day] = { ...days[day], [id]: c };
      }
    }
  }
  const lessons: FeedDB["lessons"] = { ...(remote?.lessons ?? {}) };
  for (const [id, l] of Object.entries(local.lessons)) {
    if (!lessons[id] || l.at < lessons[id].at) lessons[id] = l; // first time he read it
  }
  // Discreet mode: the side he changed last wins (so it can be switched OFF on another phone too)
  const ls = local.settings ?? { discreet: false };
  const rs = remote?.settings;
  let settings: FeedDB["settings"];
  if (!ls.updatedAt && !rs?.updatedAt) settings = { discreet: Boolean(ls.discreet || rs?.discreet) }; // saved before Step 35
  else if ((rs?.updatedAt ?? "") > (ls.updatedAt ?? "")) settings = { discreet: Boolean(rs?.discreet), updatedAt: rs?.updatedAt };
  else settings = { discreet: Boolean(ls.discreet), updatedAt: ls.updatedAt };
  return { days, lessons, settings, deleted };
}

const HISTORY_LIMIT = 150;

export function mergeSocial(local: SocialDB, remote: Partial<SocialDB> | null, now: Date = new Date()): SocialDB {
  const r: SocialDB = { bookmarks: {}, interests: [], nickname: "", posts: [], replies: [], reactions: {}, reports: {}, history: {}, profile: {}, ...remote };
  const deleted = mergeTombstones(local.deleted, r.deleted, now);

  const bookmarks = newestTimes(r.bookmarks, local.bookmarks);
  for (const [id, at] of Object.entries(bookmarks)) if (isDeleted(deleted, `bm:${id}`, at)) delete bookmarks[id];

  // Topics are chosen as a whole list: the list he changed last wins
  const li = local.interestsAt ?? "";
  const ri = r.interestsAt ?? "";
  const interests = !li && !ri ? [...new Set([...r.interests, ...local.interests])] : ri > li ? [...r.interests] : [...local.interests];
  const interestsAt = li || ri ? (ri > li ? ri : li) : undefined;

  // Reactions: each one he added or removed has its own time
  const reactedAt = newestTimes(r.reactedAt, local.reactedAt);
  const reactions: SocialDB["reactions"] = {};
  for (const src of [r.reactions, local.reactions]) {
    for (const [target, kinds] of Object.entries(src ?? {})) {
      for (const kind of kinds ?? []) {
        const key = `${target}:${kind}`;
        if (isDeleted(deleted, `react:${key}`, reactedAt[key])) continue;
        if (!reactions[target]?.includes(kind)) reactions[target] = [...(reactions[target] ?? []), kind];
      }
    }
  }

  const posts = byIdNewest(r.posts, local.posts, (p) => p.createdAt)
    .filter((p) => !isDeleted(deleted, `post:${p.id}`, p.createdAt))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  const replies = byIdNewest(r.replies, local.replies, (p) => p.createdAt)
    .filter((p) => !isDeleted(deleted, `reply:${p.id}`, p.createdAt) && !isDeleted(deleted, `post:${p.postId}`, p.createdAt))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

  const reports: SocialDB["reports"] = {};
  for (const src of [r.reports, local.reports]) {
    for (const [id, rep] of Object.entries(src ?? {})) {
      if (isDeleted(deleted, `report:${id}`, rep.at)) continue;
      if (!reports[id] || rep.at > reports[id].at) reports[id] = rep;
    }
  }

  const history = Object.fromEntries(
    Object.entries(newestTimes(r.history, local.history))
      .sort((a, b) => b[1].localeCompare(a[1]) || a[0].localeCompare(b[0]))
      .slice(0, HISTORY_LIMIT),
  );

  // Name and profile travel together: whichever side he edited last wins (an older phone can't undo a deletion)
  const localProfile = local.profile ?? {};
  const remoteProfile = cleanProfile(r.profile);
  const profile = newestProfile(localProfile, remoteProfile);
  const nickname =
    localProfile.updatedAt || remoteProfile.updatedAt ? (profile === localProfile ? local.nickname : r.nickname) : local.nickname || r.nickname;

  return { bookmarks, interests, ...(interestsAt ? { interestsAt } : {}), nickname, posts, replies, reactions, reactedAt, reports, history, profile, deleted };
}

/** Tanzanian phone numbers in any common format → +255XXXXXXXXX, or null if it isn't one. */
export function normalizeTzPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  const m = /^(?:\+?255|0)?([67]\d{8})$/.exec(digits);
  return m ? `+255${m[1]}` : null;
}
