// Chooses and finds content. Pure functions — no saving here, easy to test.

import type { ContentItem, ContentKind, TopicId } from "./types";
import { LIBRARY, TOPICS } from "./library";

export type SectionId = TopicId | "expert" | "videos" | "tools";

export const SECTIONS: { id: SectionId; title: string; blurb: string }[] = [
  ...TOPICS.map((t) => ({ id: t.id as SectionId, title: t.title, blurb: "" })),
  { id: "expert", title: "Expert answers", blurb: "Real questions men ask, answered clearly." },
  { id: "videos", title: "Short videos", blurb: "Two minutes or less." },
  { id: "tools", title: "Quizzes and practical tools", blurb: "Learn by doing." },
];

const READING: ContentKind[] = ["guide", "article"];

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
        : id === "tools"
          ? library.filter((c) => c.kind === "quiz" || c.kind === "tool")
          : library.filter((c) => c.topic === id && READING.includes(c.kind));
  return pick.filter((c) => c.id !== excludeId).sort((a, b) => b.priority - a.priority);
}

/** Everything for a topic page (all formats), or a format page. */
export function sectionAll(id: SectionId, library: ContentItem[] = LIBRARY): ContentItem[] {
  if (id === "expert" || id === "videos" || id === "tools") return sectionItems(id, undefined, library);
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
    const tags = norm(c.tags.join(" ") + " " + topicTitle(c.topic) + " " + c.kind);
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
};

export const CTA_LABEL: Record<ContentKind, string> = {
  guide: "Explore guide",
  article: "Read article",
  video: "Watch",
  quiz: "Start quiz",
  tool: "Open tool",
  expert: "Read answer",
};
