// Turns a card from the Card maker (AI draft, edited by staff) into a normal library item,
// so it shows on Discover, in search, saved and topic pages exactly like the built-in cards.

import { cardBody } from "./action-shape";
import { photoUrl, type CardPhoto } from "./card-photos";
import type { ActionSpec, ChallengeId, ContentItem, TopicId } from "./types";

const TOPIC_OF: Record<ChallengeId, TopicId> = {
  last: "ejaculation",
  hard: "erection",
  her: "intimacy",
  mixes: "erection",
  train: "erection",
  reset: "confidence",
  desire: "libido",
};

export interface StudioCard {
  id: string;
  title: string;
  titleSw: string;
  summary: string;
  summarySw: string;
  minutes: number;
  action: ActionSpec;
  /** One of the card photos, or an uploaded image. */
  photo: CardPhoto | null;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  /** Where it came from, shown nowhere to men; kept for staff. */
  sourceNote?: string;
}

export const newCardId = (title: string) =>
  `card-${title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "new"}-${Date.now().toString(36).slice(-5)}`;

export function studioCardToItem(c: StudioCard): ContentItem {
  return {
    id: c.id,
    kind: "guide",
    topic: TOPIC_OF[c.action.challenges[0]] ?? "wellbeing",
    title: c.title.trim(),
    titleSw: c.titleSw.trim() || undefined,
    summary: c.summary.trim(),
    summarySw: c.summarySw.trim() || undefined,
    minutes: c.minutes,
    priority: 75,
    tags: [c.action.type, ...c.action.challenges, "card-maker"],
    body: cardBody(c.action, false),
    bodySw: cardBody(c.action, true),
    source: "Kayani Herbs",
    review: "draft",
    fixture: false,
    aiGenerated: true,
    cover: { tone: "forest", motif: "rings" },
    coverImageUrl: c.imageUrl || (c.photo ? photoUrl(c.photo) : undefined),
    ...(c.videoUrl ? { videoUrl: c.videoUrl } : {}),
    ...(c.audioUrl ? { audioUrl: c.audioUrl } : {}),
    ...(c.sourceNote ? { reviewNote: c.sourceNote.slice(0, 280) } : {}),
    action: c.action,
  };
}
