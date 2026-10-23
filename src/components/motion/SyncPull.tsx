"use client";

// Pull to refresh for Man, Me and Community post pages (Step 78): "sync now".
// A pull brings in what changed on his other phones, reloads the course and checks for new notifications
// (and, on a post, new replies). It always ends with a short answer, so the pull never feels like nothing happened.

import PullToRefresh from "./PullToRefresh";
import { useToast } from "./Toast";
import { syncNow } from "@/lib/account/sync";
import { refreshCourses } from "@/lib/course/useCourses";
import { refreshInbox } from "@/lib/notifications/inbox";
import { useT } from "@/lib/i18n";

export default function SyncPull({ also, children }: { /** Something extra to reload on this page (e.g. a post's replies). */ also?: () => Promise<unknown>; children: React.ReactNode }) {
  const showToast = useToast();
  const t = useT();
  const refresh = async () => {
    const [sync] = await Promise.all([
      syncNow().catch(() => "error" as const),
      refreshCourses().catch(() => {}),
      refreshInbox(true).catch(() => {}),
      also?.().catch(() => {}),
    ]);
    if (sync === "offline") showToast(t("You're offline. Showing what's on this phone."));
    else if (sync === "error") showToast(t("Couldn't reach the server. Try again in a moment."));
    else showToast(t("Everything is up to date"));
  };
  return <PullToRefresh onRefresh={refresh}>{children}</PullToRefresh>;
}
