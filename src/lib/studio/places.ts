// Where men see things now (Step 71), and which content fills each place.
// Discover changed in Steps 60–70: it's the Reels row, reels between the cards, and the "do this" cards.
// The old places (Featured insight, For you, Quick learning, question card, topic tiles) are gone from Discover.
// The Content Studio uses this to let staff add content straight into a place, and the editor's
// "Where it shows" list.

import type { ContentItem, ContentKind, TopicId } from "../content/types";
import { isReel } from "../content/reels";

export type PlaceId = "reels" | "cards" | "man" | "library";

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
    id: "reels",
    title: "Reels on Discover",
    where: "The Reels row at the top of Discover, between the cards, and full screen when he taps one.",
    add: "An upright video (9:16), best under 90 seconds, MP4 under 50 MB. Title and caption in English and Kiswahili.",
    kinds: ["reel"],
    preset: { kind: "reel", minutes: 1 },
    shows: isReel,
  },
  {
    id: "cards",
    title: "“Do this” cards on Discover",
    where: "The cards men swipe through on Discover. Made in Card maker.",
    add: "Use Card maker: a short title, the steps, and a photo.",
    kinds: [],
    preset: {},
    shows: (c) => Boolean(c.action),
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
  {
    id: "library",
    title: "Library",
    where: "Search, Saved, Kito's answers, topic pages and links from cards. Not on Discover itself.",
    add: "Guides, articles, videos, audio, quizzes and expert answers. Set the topic well — that's how search and Kito find it.",
    kinds: ["guide", "article", "video", "audio", "quiz", "tool", "expert", "infographic"],
    preset: {},
    shows: (c) => c.kind !== "reel" && !c.action,
  },
];

export const isPlaceId = (v: string | null): v is PlaceId => PLACES.some((p) => p.id === v);
export const placeById = (id: PlaceId) => PLACES.find((p) => p.id === id)!;

/** A new item for a place (and optionally a topic). */
export function presetFor(base: ContentItem, place: PlaceId | null, topic: TopicId | null): ContentItem {
  const p = place ? placeById(place).preset : {};
  return { ...base, ...p, ...(topic ? { topic } : {}) };
}

/** Every place this item shows in, for the editor's "Where it shows" list. */
export const placesOf = (c: ContentItem) => PLACES.filter((p) => p.shows(c));
