// The cards and sections men see on Social → Discover (and the Man tab), and which content fills each one.
// The Content Studio uses this to let staff add content straight into a place.

import type { ContentItem, ContentKind, TopicId } from "../content/types";
import { FEATURABLE } from "../content/select";

export type PlaceId = "featured" | "for-you" | "videos" | "question" | "topics" | "man";

export interface Place {
  id: PlaceId;
  title: string;
  /** Where he sees it */
  where: string;
  /** What to upload */
  add: string;
  /** Content types that can appear here */
  kinds: ContentKind[];
  /** Starting values for a new item made for this place */
  preset: Partial<ContentItem>;
  /** Is this item shown in this place? */
  shows: (c: ContentItem) => boolean;
}

export const PLACES: Place[] = [
  {
    id: "featured",
    title: "Featured insight",
    where: "The big card at the top of Discover.",
    add: "A guide, article, video or expert answer, pinned to the top. Several pins take turns, one per day.",
    kinds: FEATURABLE,
    preset: { kind: "guide", featured: true, priority: 80 },
    shows: (c) => Boolean(c.featured) && FEATURABLE.includes(c.kind),
  },
  {
    id: "for-you",
    title: "For you",
    where: "2–3 picks under Featured, matched to the topics he follows.",
    add: "Guides, articles, quizzes and tools. Set the topic well — that's how they reach the right men.",
    kinds: ["guide", "article", "quiz", "tool"],
    preset: { kind: "article" },
    shows: (c) => ["guide", "article", "quiz", "tool"].includes(c.kind),
  },
  {
    id: "videos",
    title: "Quick learning",
    where: "Short videos (2 minutes or less) on Discover and under All videos.",
    add: "Upload a short video (MP4, under 50 MB) with a cover photo and key points.",
    kinds: ["video"],
    preset: { kind: "video", minutes: 2 },
    shows: (c) => c.kind === "video",
  },
  {
    id: "question",
    title: "A question men often ask",
    where: "The green question card on Discover, changing daily.",
    add: "An expert answer: the question a man asked, and a clear answer.",
    kinds: ["expert"],
    preset: { kind: "expert" },
    shows: (c) => c.kind === "expert" && Boolean(c.question),
  },
  {
    id: "topics",
    title: "Explore all topics",
    where: "The topic tiles at the bottom of Discover. Everything you publish appears in its topic.",
    add: "Any kind of content. Choose the topic tile it belongs to.",
    kinds: ["guide", "article", "video", "quiz", "tool", "expert"],
    preset: {},
    shows: () => true,
  },
  {
    id: "man",
    title: "Daily lesson on Man",
    where: "The lesson card on the Man tab. He earns points when he reads it.",
    add: "A short article or guide (2–4 minutes) marked as a daily lesson.",
    kinds: ["article", "guide"],
    preset: { kind: "article", inManFeed: true, minutes: 3 },
    shows: (c) => Boolean(c.inManFeed),
  },
];

export const isPlaceId = (v: string | null): v is PlaceId => PLACES.some((p) => p.id === v);
export const placeById = (id: PlaceId) => PLACES.find((p) => p.id === id)!;

/** A new item for a place (and optionally a topic tile). */
export function presetFor(base: ContentItem, place: PlaceId | null, topic: TopicId | null): ContentItem {
  const p = place ? placeById(place).preset : {};
  return { ...base, ...p, ...(topic ? { topic } : {}) };
}

/** Every place this item shows in, for the editor's "Where it shows" list. */
export const placesOf = (c: ContentItem) => PLACES.filter((p) => p.shows(c));
