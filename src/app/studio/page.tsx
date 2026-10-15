"use client";

// Overview: the health of Men's Social at a glance. Every number comes from the database (admin_overview);
// anything not measured yet says so instead of showing 0.

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, CheckCircle2, FileText, Flag, PenLine, Smartphone, Sparkles } from "lucide-react";
import { useStudio } from "@/components/admin/AdminShell";
import DailyColumns from "@/components/admin/Chart";
import type { Overview } from "@/lib/admin/types";
import { ErrorBox, Loading, Panel, PageHeader, Segmented, Stat, ago, btn, useLoad } from "@/components/admin/ui";
import { rpc, select } from "@/lib/admin/api";
import { actionLabel } from "@/lib/admin/audit";
import { staffName } from "@/lib/studio/username";
import { LIBRARY } from "@/lib/content/library";


type AuditRow = { id: number; action: string; target: string | null; actor_role: string | null; at: string; details: Record<string, unknown> };

export default function OverviewPage() {
  const studio = useStudio();
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const o = useLoad(() => rpc<Overview>("admin_overview", { p_days: Number(days) }), [days]);
  const audit = useLoad(
    () => (studio.can("audit.view") ? select<AuditRow>("admin_audit", "id,action,target,actor_role,at,details", (q) => q.order("at", { ascending: false }).limit(8)) : Promise.resolve([])),
    [studio],
  );
  const d = o.data;
  const name = studio.admin.displayName || staffName(studio.admin.email);

  const tasks = d
    ? [
        d.community.urgent_reports > 0 && studio.can("community.moderate") && { tone: "bad", icon: AlertTriangle, text: `${d.community.urgent_reports} urgent community ${d.community.urgent_reports === 1 ? "report" : "reports"}`, href: "/studio/community?tab=reports" },
        d.community.open_reports - d.community.urgent_reports > 0 && studio.can("community.moderate") && { tone: "warn", icon: Flag, text: `${d.community.open_reports - d.community.urgent_reports} other open ${d.community.open_reports - d.community.urgent_reports === 1 ? "report" : "reports"}`, href: "/studio/community?tab=reports" },
        d.content.review > 0 && { tone: "warn", icon: FileText, text: `${d.content.review} ${d.content.review === 1 ? "item waits" : "items wait"} for review`, href: "/studio/content" },
        d.homepage.has_draft && { tone: "warn", icon: Smartphone, text: "Homepage has unpublished changes", href: "/studio/homepage" },
        d.ai_errors_24h > 0 && { tone: "warn", icon: Sparkles, text: `${d.ai_errors_24h} AI ${d.ai_errors_24h === 1 ? "request" : "requests"} failed in 24 hours`, href: "/studio/ai" },
        d.content.scheduled > 0 && { tone: "info", icon: FileText, text: `${d.content.scheduled} ${d.content.scheduled === 1 ? "item is" : "items are"} scheduled to go live`, href: "/studio/content" },
        d.notifications.scheduled > 0 && { tone: "info", icon: Bell, text: `${d.notifications.scheduled} ${d.notifications.scheduled === 1 ? "notification is" : "notifications are"} scheduled`, href: "/studio/notifications" },
      ].filter(Boolean) as { tone: string; icon: typeof Flag; text: string; href: string }[]
    : [];

  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
  const trackedNote = (since: string | null) =>
    since ? `Counting since ${new Date(since + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Starts counting once men use the updated app";

  return (
    <div>
      <PageHeader
        title={`Hello, ${name}`}
        sub="How Men's Social is doing. Numbers are totals; nobody's private records are shown."
        actions={<Segmented label="Time range" value={days} onChange={setDays} options={[{ id: "7", label: "7 days" }, { id: "30", label: "30 days" }, { id: "90", label: "90 days" }]} />}
      />

      {o.error && <ErrorBox error={o.error} onRetry={o.reload} />}
      {!d && o.loading && <Loading />}

      {d && (
        <div className={`space-y-5 transition-opacity ${o.loading ? "opacity-60" : ""}`}>
          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            {studio.can("content.edit") && (
              <Link href="/studio/edit" className={btn.primary}>
                <PenLine size={15} /> New content
              </Link>
            )}
            {studio.can("homepage.edit") && (
              <Link href="/studio/homepage" className={btn.ghost}>
                <Smartphone size={15} /> Edit homepage
              </Link>
            )}
            {studio.can("notifications.send") && (
              <Link href="/studio/notifications" className={btn.ghost}>
                <Bell size={15} /> New notification
              </Link>
            )}
            {studio.can("community.moderate") && (
              <Link href="/studio/community" className={btn.ghost}>
                <Flag size={15} /> Moderate
              </Link>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Registered men" value={d.users_total} hint={`${d.users_new} new in ${d.days} days`} />
            <Stat label="New sign-ups" value={d.users_new} delta={{ now: d.users_new, prev: d.users_new_prev }} />
            <Stat label="Active today" value={d.tracking_since ? d.dau : null} hint={trackedNote(d.tracking_since)} />
            <Stat label="Active in 30 days" value={d.tracking_since ? d.mau : null} hint={d.tracking_since ? `${d.wau} in the last 7 days` : undefined} />
            <Stat
              label="Came back after a week"
              value={d.retention_7d ? `${pct(d.retention_7d.returned, d.retention_7d.cohort)}%` : null}
              hint={d.retention_7d ? `${d.retention_7d.returned} of ${d.retention_7d.cohort} men who joined 7–37 days ago` : "Needs men who joined at least a week after tracking started"}
            />
            <Stat label="Content views" value={d.engagement_tracking_since ? d.views : null} delta={d.engagement_tracking_since ? { now: d.views, prev: d.views_prev } : null} hint={d.engagement_tracking_since ? undefined : trackedNote(null)} />
            <Stat
              label="Finished"
              value={d.engagement_tracking_since ? (pct(d.completes, d.views) === null ? "—" : `${pct(d.completes, d.views)}%`) : null}
              hint={d.engagement_tracking_since ? `${d.completes} finished · ${d.saves} saved` : undefined}
            />
            <Stat label="Live Studio content" value={d.content.published} hint={`${d.content.drafts} ${d.content.drafts === 1 ? "draft" : "drafts"} · ${d.content.review} in review · plus ${LIBRARY.length} built-in`} />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-5">
              <Panel title="New sign-ups" sub="Accounts created per day">
                <DailyColumns data={d.signups_series} label="Sign-ups" unit="men" />
              </Panel>
              <Panel title="Active men" sub={d.tracking_since ? "Signed-in men who opened the app, per day" : "Not tracked yet"}>
                {d.tracking_since ? (
                  <DailyColumns data={d.active_series} label="Active" unit="men" />
                ) : (
                  <p className="text-sm text-ink-soft">This starts counting when signed-in men open the updated app. Earlier days can&apos;t be recovered.</p>
                )}
              </Panel>
              <Panel title="Content views" sub={d.engagement_tracking_since ? "Guides, articles, videos and answers opened per day" : "Not tracked yet"}>
                {d.engagement_tracking_since ? (
                  <DailyColumns data={d.views_series} label="Views" unit="views" />
                ) : (
                  <p className="text-sm text-ink-soft">Views are counted (with no link to who) from the updated app onwards.</p>
                )}
              </Panel>
            </div>

            <div className="space-y-5">
              <Panel title="Needs attention">
                {tasks.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-forest">
                    <CheckCircle2 size={16} /> Nothing waiting.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {tasks.map((t) => (
                      <li key={t.text}>
                        <Link
                          href={t.href}
                          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
                            t.tone === "bad" ? "bg-red-50 text-red-800" : t.tone === "warn" ? "bg-amber-50 text-amber-900" : "bg-bg text-ink"
                          }`}
                        >
                          <t.icon size={15} className="shrink-0" /> {t.text}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Community" sub={`Last ${d.days} days`}>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-ink-soft">Questions</dt>
                    <dd className="text-lg font-semibold tabular-nums">{d.community.posts}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-soft">Replies</dt>
                    <dd className="text-lg font-semibold tabular-nums">{d.community.replies}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-soft">Open reports</dt>
                    <dd className="text-lg font-semibold tabular-nums">{d.community.open_reports}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-soft">Urgent</dt>
                    <dd className="text-lg font-semibold tabular-nums">{d.community.urgent_reports}</dd>
                  </div>
                </dl>
              </Panel>

              <Panel title="Notifications" sub={`In-app messages, last ${d.days} days`}>
                <dl className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-ink-soft">Messages sent</dt>
                    <dd className="text-lg font-semibold tabular-nums">{d.notifications.sent}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-soft">Reached inboxes</dt>
                    <dd className="text-lg font-semibold tabular-nums">{d.notifications.delivered}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-soft">Opened</dt>
                    <dd className="text-lg font-semibold tabular-nums">{d.notifications.opened}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-[11px] text-ink-soft">One message can reach many men. Reached = it appeared in his inbox when he opened the app. Phone push isn&apos;t connected yet.</p>
              </Panel>

              {studio.can("audit.view") && (
                <Panel title="Recent admin activity" actions={<Link href="/studio/settings?tab=audit" className="text-xs font-semibold text-forest">All</Link>}>
                  {audit.error ? (
                    <p className="text-xs text-ink-soft">{audit.error}</p>
                  ) : !audit.data ? (
                    <p className="text-xs text-ink-soft">Loading…</p>
                  ) : audit.data.length === 0 ? (
                    <p className="text-xs text-ink-soft">No admin actions recorded yet.</p>
                  ) : (
                    <ul className="space-y-2 text-xs">
                      {audit.data.map((a) => (
                        <li key={a.id} className="flex justify-between gap-2">
                          <span className="min-w-0 truncate">
                            <b className="font-semibold">{actionLabel(a.action)}</b>
                            {typeof a.details?.title === "string" ? ` · ${a.details.title}` : ""}
                          </span>
                          <span className="shrink-0 text-ink-soft">{ago(a.at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
