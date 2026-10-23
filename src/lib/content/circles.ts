// The circles at the top of Discover (Last longer, Stronger erections, Satisfy her…), Step 80.
// One list for the men's app AND the Studio, so what staff pick when uploading is what men tap.
//
// Where a piece of content's circles come from:
//  - "do this" cards: their action's challenges (Card maker, built-in cards)
//  - reels, articles, videos…: plain tags ("last", "hard"…), set in the Studio editor
//  - older items with neither: worked out from their topic (erection → Stronger erections, …)
// Every item still has a topic behind the scenes (search, "topics I follow", Community, notification
// groups use it). It's set automatically from the first circle. Content about fertility or sleep/body
// that fits no circle keeps one of those two topics and shows under "For you" only.

import type { ChallengeId, ContentItem, TopicId } from "./types";

export const CIRCLES: { id: ChallengeId; label: string }[] = [
  { id: "last", label: "Last longer" },
  { id: "hard", label: "Stronger erections" },
  { id: "her", label: "Satisfy her" },
  { id: "mixes", label: "Natural mixes" },
  { id: "train", label: "Exercises" },
  { id: "reset", label: "Quit porn" },
  { id: "desire", label: "Desire and round two" },
];
export const CIRCLE_IDS: ChallengeId[] = CIRCLES.map((c) => c.id);
export const CIRCLE_LABEL = Object.fromEntries(CIRCLES.map((c) => [c.id, c.label])) as Record<ChallengeId, string>;

/** Content that fits no circle: shown under "For you", found in search and in "topics I follow". */
export const NO_CIRCLE: { topic: TopicId; label: string }[] = [
  { topic: "fertility", label: "Fertility" },
  { topic: "wellbeing", label: "Sleep and body" },
];

/** The topic each circle files content under (behind the scenes). */
export const TOPIC_OF_CIRCLE: Record<ChallengeId, TopicId> = {
  last: "ejaculation",
  hard: "erection",
  her: "intimacy",
  mixes: "erection",
  train: "erection",
  reset: "confidence",
  desire: "libido",
};

/** For older content that has a topic but no circle yet. */
const CIRCLE_OF_TOPIC: Partial<Record<TopicId, ChallengeId>> = {
  erection: "hard",
  ejaculation: "last",
  libido: "desire",
  intimacy: "her",
  confidence: "reset",
};

export const isCircle = (t: string): t is ChallengeId => (CIRCLE_IDS as string[]).includes(t);

/** The circles a piece of content shows under on Discover. */
export function circlesOf(item: Pick<ContentItem, "tags" | "topic"> & { action?: { challenges: ChallengeId[] } }): ChallengeId[] {
  if (item.action?.challenges?.length) return item.action.challenges;
  const fromTags = CIRCLE_IDS.filter((id) => item.tags?.includes(id));
  if (fromTags.length) return fromTags;
  const t = CIRCLE_OF_TOPIC[item.topic];
  return t ? [t] : [];
}

/** Put content in these circles (Studio editor). No circles = one of the NO_CIRCLE topics. */
export function setCircles<T extends ContentItem>(item: T, circles: ChallengeId[], noCircleTopic: TopicId = "wellbeing"): T {
  const tags = [...item.tags.filter((t) => !isCircle(t)), ...circles];
  const topic = circles.length ? TOPIC_OF_CIRCLE[circles[0]] : NO_CIRCLE.some((n) => n.topic === item.topic) ? item.topic : noCircleTopic;
  return {
    ...item,
    tags,
    topic,
    ...(item.action && circles.length ? { action: { ...item.action, challenges: circles } } : {}),
  };
}

/** "Last longer · Satisfy her", or "Fertility" for content outside the circles. */
export function circleNames(item: Pick<ContentItem, "tags" | "topic"> & { action?: { challenges: ChallengeId[] } }): string {
  const c = circlesOf(item);
  if (c.length) return c.map((id) => CIRCLE_LABEL[id]).join(" · ");
  return NO_CIRCLE.find((n) => n.topic === item.topic)?.label ?? "For you";
}
