// Converts between a database row (snake_case) and the app's ContentItem.
// Defensive: bad or missing values from the database never crash the app.

import type { ContentItem, ContentKind, ContentStatus, QuizQuestion, ToolId, TopicId } from "./types";

export interface ContentRow {
  id: string;
  status: ContentStatus;
  kind: ContentKind;
  topic: TopicId;
  title: string;
  title_sw: string | null;
  summary: string;
  minutes: number;
  priority: number;
  tags: string[];
  body: string[];
  body_sw: string[];
  key_points: string[];
  question: string | null;
  quiz: QuizQuestion[] | null;
  tool: ToolId | null;
  source: string;
  review: "draft" | "reviewed";
  cover: ContentItem["cover"];
  cover_image_url: string | null;
  origin: ContentItem["origin"] | null;
  in_man_feed: boolean;
  points: number;
  published_at?: string | null;
  /** Added by migration 0004 — may be missing on databases that haven't run it yet. */
  featured?: boolean;
  video_url?: string | null;
  summary_sw?: string | null;
  /** Added by migration 0006 */
  publish_at?: string | null;
  review_note?: string | null;
  ai_generated?: boolean;
  audio_url?: string | null;
  updated_at?: string;
}

const KINDS: ContentKind[] = ["guide", "article", "video", "quiz", "tool", "expert", "audio", "infographic"];
const TOPICS: TopicId[] = ["erection", "ejaculation", "libido", "fertility", "confidence", "intimacy", "wellbeing"];
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function rowToItem(row: Partial<ContentRow>): ContentItem | null {
  if (!row.id || !row.title || !KINDS.includes(row.kind as ContentKind) || !TOPICS.includes(row.topic as TopicId)) {
    return null;
  }
  const body = strArr(row.body);
  const bodySw = strArr(row.body_sw);
  const keyPoints = strArr(row.key_points);
  return {
    id: row.id,
    status: row.status ?? "draft",
    kind: row.kind as ContentKind,
    topic: row.topic as TopicId,
    title: row.title,
    titleSw: row.title_sw || undefined,
    summary: row.summary ?? "",
    minutes: Number(row.minutes) || 3,
    priority: Number.isFinite(row.priority) ? Number(row.priority) : 50,
    tags: strArr(row.tags),
    body: body.length ? body : undefined,
    bodySw: bodySw.length ? bodySw : undefined,
    keyPoints: keyPoints.length ? keyPoints : undefined,
    question: row.question || undefined,
    quiz: Array.isArray(row.quiz) && row.quiz.length ? row.quiz : undefined,
    tool: row.tool || undefined,
    source: row.source || "Men's Social editorial",
    review: row.review === "reviewed" ? "reviewed" : "draft",
    fixture: false,
    cover: row.cover && typeof row.cover === "object" ? row.cover : { tone: "forest", motif: "rings" },
    coverImageUrl: row.cover_image_url || undefined,
    origin: row.origin || undefined,
    inManFeed: Boolean(row.in_man_feed),
    featured: Boolean(row.featured),
    summarySw: row.summary_sw || undefined,
    publishAt: row.publish_at || undefined,
    publishedAt: row.published_at || undefined,
    reviewNote: row.review_note || undefined,
    aiGenerated: Boolean(row.ai_generated),
    audioUrl: typeof row.audio_url === "string" && /^(https:\/\/|http:\/\/localhost|data:audio\/)/.test(row.audio_url) ? row.audio_url : undefined,
    videoUrl: typeof row.video_url === "string" && /^(https:\/\/|http:\/\/localhost[:/]|data:video\/)/.test(row.video_url) ? row.video_url : undefined,
    points: Number(row.points) || 10,
    updatedAt: row.updated_at,
    builtIn: false,
  };
}

export function itemToRow(item: ContentItem, status: ContentStatus): Omit<ContentRow, "updated_at"> {
  return {
    id: item.id,
    status,
    kind: item.kind,
    topic: item.topic,
    title: item.title.trim(),
    title_sw: item.titleSw?.trim() || null,
    summary: item.summary.trim(),
    minutes: item.minutes,
    priority: item.priority,
    tags: item.tags,
    body: item.body ?? [],
    body_sw: item.bodySw ?? [],
    key_points: item.keyPoints ?? [],
    question: item.question?.trim() || null,
    quiz: item.quiz ?? null,
    tool: item.tool ?? null,
    source: item.source.trim(),
    review: item.review,
    cover: item.cover,
    cover_image_url: item.coverImageUrl ?? null,
    origin: item.origin ?? null,
    in_man_feed: Boolean(item.inManFeed),
    points: item.points ?? 10,
    featured: Boolean(item.featured),
    video_url: item.videoUrl ?? null,
    summary_sw: item.summarySw?.trim() || null,
    publish_at: item.publishAt ?? null,
    review_note: item.reviewNote?.trim() || null,
    ai_generated: Boolean(item.aiGenerated),
    audio_url: item.audioUrl ?? null,
  };
}

/** Built-in items, with anything published in the Studio added — a published copy replaces the built-in one. */
export function mergeLibrary(builtIn: ContentItem[], published: ContentItem[]): ContentItem[] {
  const byId = new Map<string, ContentItem>();
  for (const c of builtIn) byId.set(c.id, { ...c, builtIn: true, status: "published" });
  for (const c of published) if (c.status === "published") byId.set(c.id, c);
  return [...byId.values()];
}
