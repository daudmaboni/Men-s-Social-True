// Editor helpers: making ids, splitting text into paragraphs, and what's needed before publishing.

import type { ContentItem } from "../content/types";
import { checkClaims, hasBlocks } from "./claims";

/** "Sleep & your erections!" → "sleep-and-your-erections" (matches the database id rule). */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");
}

export const ID_RULE = /^[a-z0-9][a-z0-9-]{2,80}$/;

/** Text box ↔ paragraphs: a blank line starts a new paragraph. */
export const toParagraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim().replace(/\s*\n\s*/g, " "))
    .filter(Boolean);
export const fromParagraphs = (ps?: string[]) => (ps ?? []).join("\n\n");

/** Text box ↔ list: one item per line. */
export const toLines = (text: string): string[] => text.split("\n").map((l) => l.trim()).filter(Boolean);
export const fromLines = (ls?: string[]) => (ls ?? []).join("\n");

/** Problems that stop an item being published. Empty list = ready. */
export function publishProblems(item: ContentItem): string[] {
  const p: string[] = [];
  if (item.kind === "reel") {
    // A reel is just a video and a caption
    if (!item.videoUrl) p.push("Choose the video.");
    if (item.title.trim().length < 3) p.push("Write the caption.");
  } else {
    if (!ID_RULE.test(item.id)) p.push("The web address (id) needs at least 3 letters or numbers.");
    if (item.title.trim().length < 3) p.push("Add a title.");
  }
  if (item.kind !== "reel" && item.summary.trim().length < 10) p.push("Add a short summary (one or two sentences).");
  if (item.source.trim().length < 3) p.push("Say who wrote or checked it (Source).");

  const hasBody = (item.body ?? []).length > 0;
  if (item.kind === "guide" || item.kind === "article") {
    if (!hasBody) p.push("Write the text.");
  }
  if (item.kind === "expert") {
    if (!item.question?.trim()) p.push("Add the question a man asked.");
    if (!hasBody) p.push("Write the answer.");
  }
  if (item.kind === "video" && !(item.keyPoints ?? []).length && !hasBody) p.push("Add key points for the video.");
  if (item.kind === "quiz") {
    const qs = item.quiz ?? [];
    if (qs.length === 0) p.push("Add at least one quiz question.");
    qs.forEach((q, i) => {
      const filled = q.options.filter((o) => o.trim());
      if (!q.q.trim()) p.push(`Question ${i + 1}: write the question.`);
      if (filled.length < 2) p.push(`Question ${i + 1}: give at least two answers.`);
      if (!q.options[q.answer]?.trim()) p.push(`Question ${i + 1}: choose the correct answer.`);
    });
  }
  if (item.kind === "tool" && !item.tool) p.push("Choose which tool to show.");
  if (item.kind === "audio" && !item.audioUrl) p.push("Upload the audio or paste a link to it.");
  if (item.kind === "infographic" && !item.coverImageUrl) p.push("Upload the infographic image (Cover → Upload photo).");
  if ((item.bodySw ?? []).length > 0 && !item.titleSw?.trim()) p.push("Add the Kiswahili title too.");
  if (hasBlocks(checkClaims(item))) p.push("Fix the red items in the claim check.");
  return p;
}

/** A fresh, empty item for the editor. */
export function blankItem(): ContentItem {
  return {
    id: "",
    kind: "article",
    topic: "wellbeing",
    title: "",
    summary: "",
    minutes: 3,
    priority: 50,
    tags: [],
    body: [],
    source: "Men's Social editorial · Kayani Herbs",
    review: "draft",
    fixture: false,
    cover: { tone: "forest", motif: "rings" },
    points: 10,
    status: "draft",
  };
}
