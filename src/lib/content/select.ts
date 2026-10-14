// Chooses and finds content. Pure functions — no saving here, easy to test.

import type { ContentItem, ContentKind, TopicId } from "./types";
import { LIBRARY, TOPICS } from "./library";
import { SW } from "../i18n/sw";

export type SectionId = TopicId | "expert" | "videos" | "audio" | "tools";

export const SECTIONS: { id: SectionId; title: string; blurb: string }[] = [
  ...TOPICS.map((t) => ({ id: t.id as SectionId, title: t.title, blurb: "" })),
  { id: "expert", title: "Expert answers", blurb: "Real questions men ask, answered clearly." },
  { id: "videos", title: "Short videos", blurb: "Two minutes or less." },
  { id: "audio", title: "Audio and podcasts", blurb: "Listen on the go." },
  { id: "tools", title: "Quizzes and practical tools", blurb: "Learn by doing." },
];

const READING: ContentKind[] = ["guide", "article", "infographic"];
/** Kinds that can be pinned as the Featured card. */
export const FEATURABLE: ContentKind[] = ["guide", "article", "video", "expert", "audio", "infographic"];

export function getContent(id: string, library: ContentItem[] = LIBRARY): ContentItem | undefined {
  return library.find((c) => c.id === id);
}

export function sectionTitle(id: string): string | undefined {
  return SECTIONS.find((s) => s.id === id)?.title;
}

export function isSectionId(id: string): id is SectionId {
  return SECTIONS.some((s) => s.id === id);
}

/**
 * Featured item: highest editorial priority among guides/articles,
 * boosted when it matches a topic he chose, and when it's real content rather than a sample.
 * Ties broken by id so it's stable.
 */
export function pickFeatured(interests: TopicId[], library: ContentItem[] = LIBRARY): ContentItem | null {
  const candidates = library.filter((c) => READING.includes(c.kind));
  if (candidates.length === 0) return null;
  const score = (c: ContentItem) =>
    c.priority + (interests.includes(c.topic) ? 60 : 0) + (c.kind === "guide" ? 5 : 0) + (c.fixture ? 0 : 30);
  return [...candidates].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0];
}

/** Items for a row on Discover. Topic rows show reading content; format rows show that format. */
export function sectionItems(id: SectionId, excludeId?: string, library: ContentItem[] = LIBRARY): ContentItem[] {
  const pick =
    id === "expert"
      ? library.filter((c) => c.kind === "expert")
      : id === "videos"
        ? library.filter((c) => c.kind === "video")
        : id === "audio"
          ? library.filter((c) => c.kind === "audio")
        : id === "tools"
          ? library.filter((c) => c.kind === "quiz" || c.kind === "tool")
          : library.filter((c) => c.topic === id && READING.includes(c.kind));
  return pick.filter((c) => c.id !== excludeId).sort((a, b) => b.priority - a.priority);
}

/** Everything for a topic page (all formats), or a format page. */
export function sectionAll(id: SectionId, library: ContentItem[] = LIBRARY): ContentItem[] {
  if (id === "expert" || id === "videos" || id === "audio" || id === "tools") return sectionItems(id, undefined, library);
  return library.filter((c) => c.topic === id).sort((a, b) => b.priority - a.priority);
}

/** Order sections so the ones he cares about come first (stable otherwise). */
export function orderSections(interests: TopicId[]) {
  return [...SECTIONS].sort((a, b) => {
    const ai = interests.includes(a.id as TopicId) ? 0 : 1;
    const bi = interests.includes(b.id as TopicId) ? 0 : 1;
    return ai - bi;
  });
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ");

/** Search across titles, tags, summaries, questions and text. Every word must match somewhere. */
export function searchContent(query: string, library: ContentItem[] = LIBRARY): ContentItem[] {
  const words = norm(query).split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return [];
  const topicTitle = (id: TopicId) => TOPICS.find((t) => t.id === id)?.title ?? "";

  const scored = library.map((c) => {
    const title = norm(c.title);
    const tags = norm(c.tags.join(" ") + " " + topicTitle(c.topic) + " " + (SW[topicTitle(c.topic)] ?? "") + " " + c.kind);
    const rest = norm(
      [c.summary, c.question ?? "", c.titleSw ?? "", ...(c.body ?? []), ...(c.bodySw ?? []), ...(c.keyPoints ?? [])].join(" "),
    );
    let score = 0;
    for (const w of words) {
      const s = (title.includes(w) ? 3 : 0) + (tags.includes(w) ? 2 : 0) + (rest.includes(w) ? 1 : 0);
      if (s === 0) return { c, score: 0 };
      score += s;
    }
    return { c, score: score + c.priority / 1000 };
  });

  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.c);
}

export const KIND_LABEL: Record<ContentKind, string> = {
  guide: "Guide",
  article: "Article",
  video: "Video",
  quiz: "Quiz",
  tool: "Tool",
  expert: "Expert answer",
  audio: "Audio",
  infographic: "Infographic",
};

export const CTA_LABEL: Record<ContentKind, string> = {
  guide: "Explore guide",
  article: "Read article",
  video: "Watch",
  quiz: "Start quiz",
  tool: "Open tool",
  expert: "Read answer",
  audio: "Listen",
  infographic: "View",
};

/* ───────────── Discover home: show less, deliver more ───────────── */

export interface Personal {
  interests: TopicId[];
  /** contentId → when he saved it */
  bookmarks: Record<string, string>;
  /** contentId → when he last opened it */
  history: Record<string, string>;
}

/** Day number, so daily picks change once a day (not on every visit). */
export const dayNumber = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);

/** Topics he has shown interest in by saving or reading (not only the ones he ticked). */
function engagedTopics(p: Personal, library: ContentItem[]): Map<TopicId, number> {
  const weight = new Map<TopicId, number>();
  const add = (id: string, w: number) => {
    const c = library.find((x) => x.id === id);
    if (c) weight.set(c.topic, (weight.get(c.topic) ?? 0) + w);
  };
  Object.keys(p.bookmarks).forEach((id) => add(id, 2));
  Object.keys(p.history).forEach((id) => add(id, 1));
  return weight;
}

/**
 * Featured insight that rotates daily among the best few candidates, so the top of Discover
 * isn't the same forever. Prefers things he hasn't opened yet.
 */
export function featuredToday(p: Personal, library: ContentItem[], day = dayNumber()): ContentItem | null {
  // Items staff pinned as Featured in the Content Studio come first (rotating daily if there are several),
  // skipping ones he has already read when there's an unread one.
  const pinned = library.filter((c) => c.featured && FEATURABLE.includes(c.kind));
  const pinnedUnread = pinned.filter((c) => !p.history[c.id]);
  const pins = pinnedUnread.length ? pinnedUnread : pinned;
  if (pins.length) return [...pins].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[day % pins.length];

  const candidates = library.filter((c) => READING.includes(c.kind));
  if (!candidates.length) return null;
  const score = (c: ContentItem) =>
    c.priority + (p.interests.includes(c.topic) ? 60 : 0) + (c.kind === "guide" ? 5 : 0) + (c.fixture ? 0 : 30) - (p.history[c.id] ? 70 : 0);
  const top = [...candidates].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id)).slice(0, 3);
  return top[day % top.length];
}

export interface Recommendation {
  item: ContentItem;
  /** Shown under the card, so he knows why it's there. */
  reason: string;
  /** The same reason as a translatable template ("Because you follow {topic}") and the topic's short name. */
  why: { key: string; topic: string };
}

/**
 * Two or three picks for him. Based on the topics he chose, what he saved and read;
 * skips what he already read and the featured item; mixes topics so it's not three of the same.
 * New men get a balanced set of good starting points.
 */
export function recommendations(p: Personal, library: ContentItem[], exclude: string[] = [], count = 3): Recommendation[] {
  const engaged = engagedTopics(p, library);
  const isNew = p.interests.length === 0 && engaged.size === 0;
  const pool = library.filter((c) => (READING.includes(c.kind) || c.kind === "tool" || c.kind === "quiz") && !exclude.includes(c.id) && !p.history[c.id]);

  const reasonFor = (c: ContentItem): { score: number; reason: string; why: Recommendation["why"] } => {
    const topic = TOPICS.find((t) => t.id === c.topic)?.short ?? "";
    const r = (score: number, key: string) => ({ score, why: { key, topic }, reason: key.replace("{topic}", key.includes("read about") ? topic.toLowerCase() : topic) });
    if (p.interests.includes(c.topic)) return r(c.priority + 100, "Because you follow {topic}");
    const e = engaged.get(c.topic) ?? 0;
    if (e > 0) return r(c.priority + 40 + e * 10, "Because you read about {topic}");
    return r(c.priority, isNew ? "A good place to start" : "Popular with men like you");
  };

  const ranked = pool
    .map((item) => ({ item, ...reasonFor(item) }))
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));

  // Mix topics: at most one per topic first, then fill up if needed
  const picked: typeof ranked = [];
  for (const r of ranked) if (picked.length < count && !picked.some((x) => x.item.topic === r.item.topic)) picked.push(r);
  for (const r of ranked) if (picked.length < count && !picked.includes(r)) picked.push(r);
  return picked.map(({ item, reason, why }) => ({ item, reason, why }));
}

/** One or two short videos, favouring his topics. */
export function quickVideos(p: Personal, library: ContentItem[], count = 2): ContentItem[] {
  return library
    .filter((c) => c.kind === "video")
    .sort((a, b) => Number(p.interests.includes(b.topic)) - Number(p.interests.includes(a.topic)) || Number(!!p.history[a.id]) - Number(!!p.history[b.id]) || b.priority - a.priority)
    .slice(0, count);
}

/** One question men often ask, changing daily, favouring his topics and ones he hasn't read. */
export function questionToday(p: Personal, library: ContentItem[], day = dayNumber()): ContentItem | null {
  const all = library.filter((c) => c.kind === "expert" && c.question);
  if (!all.length) return null;
  const unread = all.filter((c) => !p.history[c.id]);
  const mine = unread.filter((c) => p.interests.includes(c.topic));
  const pool = mine.length ? mine : unread.length ? unread : all;
  return [...pool].sort((a, b) => a.id.localeCompare(b.id))[day % pool.length];
}

/** Every topic and format with how many items it has — for "Explore all topics". */
export function topicTiles(library: ContentItem[]) {
  return SECTIONS.map((s) => ({ ...s, count: sectionAll(s.id, library).length })).filter((s) => s.count > 0 || !OPTIONAL_SECTIONS.includes(s.id));
}

/** Formats that only show once the Studio has published something for them (no built-in items). */
export const OPTIONAL_SECTIONS: SectionId[] = ["audio"];
