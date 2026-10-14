// Shapes of what the admin database functions return.
import type { Point } from "@/components/admin/Chart";

export type Overview = {
  days: number;
  users_total: number;
  users_new: number;
  users_new_prev: number;
  tracking_since: string | null;
  dau: number;
  wau: number;
  mau: number;
  signups_series: Point[];
  active_series: Point[];
  retention_7d: { cohort: number; returned: number } | null;
  content: { published: number; scheduled: number; review: number; drafts: number; archived: number };
  engagement_tracking_since: string | null;
  views: number;
  views_prev: number;
  completes: number;
  saves: number;
  views_series: Point[];
  community: { posts: number; replies: number; open_reports: number; urgent_reports: number };
  notifications: { sent: number; delivered: number; opened: number; scheduled: number };
  homepage: { has_draft: boolean; live_since: string | null };
  ai_errors_24h: number;
};
