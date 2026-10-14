// How an item's state is shown in the Studio. "Scheduled" = published with a future publish time.
import type { ContentItem } from "../content/types";

export type DisplayStatus = "draft" | "review" | "scheduled" | "published" | "archived";

export function displayStatus(c: Pick<ContentItem, "status" | "publishAt">, now = new Date()): DisplayStatus {
  const s = c.status ?? "draft";
  if (s === "published" && c.publishAt && new Date(c.publishAt) > now) return "scheduled";
  return s;
}

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  draft: "Draft",
  review: "In review",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

export const STATUS_STYLE: Record<DisplayStatus, string> = {
  draft: "bg-bg text-ink-soft ring-line",
  review: "bg-amber-50 text-amber-800 ring-amber-200",
  scheduled: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900",
  published: "bg-mint text-forest-deep ring-mint-strong/40",
  archived: "bg-bg text-ink-soft ring-line line-through",
};
