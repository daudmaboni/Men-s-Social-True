// Community rules and helpers. Pure functions — easy to test, reused when the server arrives.

import type { TopicId } from "../content/types";
import { translate } from "../i18n/translate";

export type CommunityTopic = TopicId | "general";

export const COMMUNITY_TOPICS: { id: CommunityTopic; label: string }[] = [
  { id: "general", label: "General" },
  { id: "erection", label: "Erections" },
  { id: "ejaculation", label: "Lasting longer" },
  { id: "libido", label: "Desire" },
  { id: "fertility", label: "Fertility" },
  { id: "confidence", label: "Confidence" },
  { id: "intimacy", label: "Relationships" },
  { id: "wellbeing", label: "Body and mind" },
];

export type ReactionKind = "support" | "helpful" | "same";

export const REACTIONS: { kind: ReactionKind; label: string; emoji: string }[] = [
  { kind: "support", label: "Support", emoji: "🤝" },
  { kind: "helpful", label: "Helpful", emoji: "💡" },
  { kind: "same", label: "Same here", emoji: "🙋" },
];

export interface Author {
  name: string; // nickname, or "Anonymous member"
  anonymous: boolean;
}

export interface Post {
  id: string;
  topic: CommunityTopic;
  title: string;
  body: string;
  author: Author;
  createdAt: string;
  wantsExpert?: boolean;
  fixture?: boolean; // sample post for development
  mine?: boolean;
  baseReactions?: Partial<Record<ReactionKind, number>>;
  /** Shared Community (server): pinned/featured by moderators; hidden/removed = only he still sees it */
  pinned?: boolean;
  featured?: boolean;
  status?: "visible" | "hidden" | "removed";
}

export interface Reply {
  id: string;
  postId: string;
  body: string;
  author: Author;
  createdAt: string;
  fixture?: boolean;
  mine?: boolean;
  baseReactions?: Partial<Record<ReactionKind, number>>;
  status?: "visible" | "hidden" | "removed";
}

export const REPORT_REASONS = [
  "Selling or advertising",
  "Medical misinformation",
  "Harassment or disrespect",
  "Sharing someone's private information",
  "Sexual or explicit content",
  "Something else",
] as const;

const PHONE = /(\+?\d[\d\s-]{7,}\d)/;
const LINK = /(https?:\/\/|www\.|\.com\b|\.co\.tz\b|wa\.me|t\.me\/)/i;
const CONTACT = /\b(whats\s?app|call me|inbox me|dm me|nipigie|nitumie|namba yangu|my number)\b/i;
const SELLING = /\b(tsh|tzs|shilingi|price|bei|order now|buy now|nunua|for sale|inauzwa|delivery|discount)\b/i;

export const LIMITS = { titleMin: 8, titleMax: 120, bodyMax: 1000, replyMin: 2, replyMax: 600 };

/** Returns a friendly error, or null if the post can be published. */
export function checkPost(title: string, body: string): string | null {
  const t = title.trim();
  const b = body.trim();
  if (t.length < LIMITS.titleMin) return "Write your question in a few more words.";
  if (t.length > LIMITS.titleMax) return "Keep the question under 120 characters. Add details below.";
  if (b.length > LIMITS.bodyMax) return "Details can be up to 1000 characters.";
  return checkText(`${t} ${b}`);
}

export function checkReply(body: string): string | null {
  const b = body.trim();
  if (b.length < LIMITS.replyMin) return "Write a reply first.";
  if (b.length > LIMITS.replyMax) return "Replies can be up to 600 characters.";
  return checkText(b);
}

/** Shared safety checks: protects members from scams and protects privacy. */
export function checkText(text: string): string | null {
  if (PHONE.test(text)) return "Phone numbers can't be shared here, to protect everyone's privacy.";
  if (LINK.test(text)) return "Links can't be shared in the community.";
  if (CONTACT.test(text)) return "Please keep conversations in the community — no private contact requests.";
  if (SELLING.test(text)) return "Selling and prices aren't allowed in the community.";
  return null;
}

export function reactionCount(
  base: Partial<Record<ReactionKind, number>> | undefined,
  mine: ReactionKind[] | undefined,
  kind: ReactionKind,
): number {
  return (base?.[kind] ?? 0) + (mine?.includes(kind) ? 1 : 0);
}

export function toggleReaction(mine: ReactionKind[] | undefined, kind: ReactionKind): ReactionKind[] {
  const list = mine ?? [];
  return list.includes(kind) ? list.filter((k) => k !== kind) : [...list, kind];
}

/** "Most active" = replies count most, then reactions. */
export function activityScore(replies: number, reactions: number): number {
  return replies * 3 + reactions;
}

export function timeAgo(iso: string, now: Date = new Date(), lang: "en" | "sw" = "en"): string {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  const t = (en: string, n?: number) => translate(lang, en, { n: n ?? 0 });
  if (s < 60) return t("just now");
  if (s < 3600) return t("{n}m ago", Math.floor(s / 60));
  if (s < 86400) return t("{n}h ago", Math.floor(s / 3600));
  if (s < 7 * 86400) return t("{n}d ago", Math.floor(s / 86400));
  return new Date(iso).toLocaleDateString(lang === "sw" ? "sw-TZ" : "en", { day: "numeric", month: "short" });
}

export function topicLabel(id: CommunityTopic): string {
  return COMMUNITY_TOPICS.find((t) => t.id === id)?.label ?? "General";
}
