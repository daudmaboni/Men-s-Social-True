"use client";

// Admin → Analytics: what men find valuable. Counts only — the app never records who viewed what.
// Unmeasured things are labelled as such, never shown as 0.

import Retention from "@/components/admin/Retention";
import HookStats from "@/components/admin/HookStats";
import { useMemo, useState } from "react";
import { useStudio } from "@/components/admin/AdminShell";
import DailyColumns, { RankBars } from "@/components/admin/Chart";
import { ErrorBox, Loading, NotConnected, PageHeader, Panel, Segmented, Stat, btn, downloadCsv, useLoad } from "@/components/admin/ui";
import { rpc, select } from "@/lib/admin/api";
import { LIBRARY, TOPICS } from "@/lib/content/library";
import { getContentRepo } from "@/lib/content/repo";
import { mergeLibrary } from "@/lib/content/rows";
import { KIND_LABEL } from "@/lib/content/select";
import type { ContentKind } from "@/lib/content/types";
import type { Overview } from "@/lib/admin/types";

type Daily = { content_id: string; day: string; views: number; completes: number; saves: number };
type Search = { term: string; day: string; searches: number; no_results: number };
type Adoption = { synced_users: number; water: number; sleep: number; checkin: number; activities: number; lessons: number; saved: number };
type Campaign = { id: string; title: string; kind: string; status: string; send_at: string | null };
type NStat = { id: string; delivered: number; opened: number; audience: number };

export default function AnalyticsPage() {
  const studio = useStudio();
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const n = Number(days);
  const from = (k: number) => new Date(Date.now() - k * n * 864e5).toISOString().slice(0, 10);
  const o = useLoad(() => rpc<Overview>("admin_overview", { p_days: n }), [days]);
  const stats = useLoad(() => select<Daily>("content_stats_daily", "content_id,day,views,completes,saves", (q) => q.gte("day", from(2))), [days]);
  const searches = useLoad(() => select<Search>("search_stats_daily", "term,day,searches,no_results", (q) => q.gte("day", from(1))), [days]);
  const adoption = useLoad(() => rpc<Adoption>("admin_adoption"), []);
  const items = useLoad(() => getContentRepo().listAll(), []);
  const camps = useLoad(
    () =>
      studio.can("notifications.send") || studio.can("analytics.view")
        ? Promise.all([select<Campaign>("notification_campaigns", "id,title,kind,status,send_at", (q) => q.eq("status", "scheduled").neq("kind", "warning").order("send_at", { ascending: false }).limit(10)), rpc<NStat[]>("notif_stats")])
        : Promise.resolve([[], []] as [Campaign[], NStat[]]),
    [],
  );

  const library = useMemo(() => mergeLibrary(LIBRARY, (items.data ?? []).filter((c) => c.status === "published")), [items.data]);
  const byId = useMemo(() => new Map([...(items.data ?? []), ...LIBRARY].map((c) => [c.id, c])), [items.data]);

  const content = useMemo(() => {
    const cut = from(1);
    const now = new Map<string, { views: number; completes: number; saves: number }>();
    let prevViews = 0;
    for (const r of stats.data ?? []) {
      if (r.day >= cut) {
        const x = now.get(r.content_id) ?? { views: 0, completes: 0, saves: 0 };
        x.views += r.views;
        x.completes += r.completes;
        x.saves += r.saves;
        now.set(r.content_id, x);
      } else prevViews += r.views;
    }
    const rows = [...now].map(([id, v]) => ({ id, title: byId.get(id)?.title ?? id, kind: byId.get(id)?.kind, topic: byId.get(id)?.topic, ...v })).sort((a, b) => b.views - a.views);
    const byTopic = TOPICS.map((t) => ({ label: t.title, n: rows.filter((r) => r.topic === t.id).reduce((s, r) => s + r.views, 0) })).filter((r) => r.n > 0);
    const kinds = Object.keys(KIND_LABEL) as ContentKind[];
    const byKind = kinds
      .map((k) => {
        const rs = rows.filter((r) => r.kind === k);
        const v = rs.reduce((s, r) => s + r.views, 0);
        const c = rs.reduce((s, r) => s + r.completes, 0);
        return { label: KIND_LABEL[k], n: v, sub: v ? `${Math.round((c / v) * 100)}% finished` : undefined };
      })
      .filter((r) => r.n > 0);
    return { rows, byTopic, byKind, prevViews, total: rows.reduce((s, r) => s + r.views, 0), saves: rows.reduce((s, r) => s + r.saves, 0), completes: rows.reduce((s, r) => s + r.completes, 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.data, byId, days]);

  const terms = useMemo(() => {
    const m = new Map<string, { searches: number; none: number }>();
    for (const r of searches.data ?? []) {
      const x = m.get(r.term) ?? { searches: 0, none: 0 };
      x.searches += r.searches;
      x.none += r.no_results;
      m.set(r.term, x);
    }
    return [...m].map(([term, v]) => ({ term, ...v })).sort((a, b) => b.searches - a.searches);
  }, [searches.data]);

  const d = o.data;
  const tracking = Boolean(d?.engagement_tracking_since);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        sub="Counted without linking views or searches to any man. Groups under 5 men are hidden."
        actions={<Segmented label="Time range" value={days} onChange={setDays} options={[{ id: "7", label: "7 days" }, { id: "30", label: "30 days" }, { id: "90", label: "90 days" }]} />}
      />
      {/* Step 85: the pilot's real test, first */}
      <Retention />
      <HookStats />
      {o.error && <ErrorBox error={o.error} onRetry={o.reload} />}
      {!d && o.loading && <Loading />}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Content views" value={tracking ? content.total : null} delta={tracking ? { now: content.total, prev: content.prevViews } : null} />
            <Stat label="Finished" value={tracking ? content.completes : null} hint={tracking && content.total ? `${Math.round((content.completes / content.total) * 100)}% of views (read to the end, watched, listened, quiz done)` : undefined} />
            <Stat label="Saved" value={tracking ? content.saves : null} />
            <Stat label="Unique viewers" value="Not measured" hint="By design: views aren't linked to men, to protect privacy." />
          </div>
          {!tracking && (
            <NotConnected title="Engagement tracking starts with this update">
              Views, finishes, saves and searches are counted from when men use the updated app (after migration 0006). Earlier activity can&apos;t be
              recovered.
            </NotConnected>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Panel title="Content views per day">
              <DailyColumns data={d.views_series} label="Views" unit="views" />
            </Panel>
            <Panel title="Active men per day" sub={d.tracking_since ? undefined : "Not tracked yet"}>
              {d.tracking_since ? <DailyColumns data={d.active_series} label="Active" unit="men" /> : <p className="text-sm text-ink-soft">Starts with the updated app.</p>}
            </Panel>
          </div>

          <Panel
            title="Top content"
            sub={`Last ${n} days`}
            actions={
              content.rows.length ? (
                <button className={btn.small} onClick={() => downloadCsv("content-stats", content.rows.map((r) => ({ id: r.id, title: r.title, type: r.kind, topic: r.topic, views: r.views, finished: r.completes, saved: r.saves })))}>
                  Export CSV
                </button>
              ) : undefined
            }
          >
            {stats.error ? (
              <ErrorBox error={stats.error} />
            ) : content.rows.length === 0 ? (
              <p className="text-sm text-ink-soft">No views in this period yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-left text-xs text-ink-soft">
                    <tr className="border-b border-line">
                      <th className="py-2 pr-3 font-semibold">Content</th>
                      <th className="py-2 pr-3 text-right font-semibold">Views</th>
                      <th className="py-2 pr-3 text-right font-semibold">Finished</th>
                      <th className="py-2 pr-3 text-right font-semibold">Finish rate</th>
                      <th className="py-2 text-right font-semibold">Saved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {content.rows.slice(0, 15).map((r) => (
                      <tr key={r.id}>
                        <td className="max-w-xs truncate py-2 pr-3">
                          {r.title} <span className="text-[0.6875rem] text-ink-soft">· {r.kind ? KIND_LABEL[r.kind] : ""}</span>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.views}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.completes}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.views ? `${Math.round((r.completes / r.views) * 100)}%` : "—"}</td>
                        <td className="py-2 text-right tabular-nums">{r.saves}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Panel title="Views by topic">{content.byTopic.length ? <RankBars rows={content.byTopic.sort((a, b) => b.n - a.n)} unit="views" /> : <p className="text-sm text-ink-soft">No views yet.</p>}</Panel>
            <Panel title="Views by format" sub="With how many were finished">{content.byKind.length ? <RankBars rows={content.byKind.sort((a, b) => b.n - a.n)} unit="views" /> : <p className="text-sm text-ink-soft">No views yet.</p>}</Panel>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Panel
              title="What men search for"
              sub={`Last ${n} days`}
              actions={terms.length ? <button className={btn.small} onClick={() => downloadCsv("searches", terms.map((t) => ({ term: t.term, searches: t.searches, no_results: t.none })))}>Export CSV</button> : undefined}
            >
              {terms.length === 0 ? (
                <p className="text-sm text-ink-soft">No searches recorded yet.</p>
              ) : (
                <RankBars rows={terms.slice(0, 10).map((t) => ({ label: `“${t.term}”`, n: t.searches, sub: t.none ? `${t.none} found nothing` : undefined }))} unit="searches" />
              )}
            </Panel>
            <Panel title="Features used" sub="Accounts that used each feature at least once (all time)">
              {adoption.data ? (
                <RankBars
                  unit="men"
                  rows={[
                    { label: "Water", n: adoption.data.water },
                    { label: "Sleep", n: adoption.data.sleep },
                    { label: "Check-in", n: adoption.data.checkin },
                    { label: "Daily activities", n: adoption.data.activities },
                    { label: "Lessons", n: adoption.data.lessons },
                    { label: "Saved content", n: adoption.data.saved },
                  ]}
                />
              ) : (
                <p className="text-sm text-ink-soft">{adoption.error ?? "Loading…"}</p>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Panel title="Notifications" sub="Last 10 sent">
              {!camps.data ? (
                <p className="text-sm text-ink-soft">{camps.error ?? "Loading…"}</p>
              ) : camps.data[0].length === 0 ? (
                <p className="text-sm text-ink-soft">No messages sent yet.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {camps.data[0].map((c) => {
                    const s = camps.data![1].find((x) => x.id === c.id);
                    return (
                      <li key={c.id} className="flex justify-between gap-2 py-2">
                        <span className="truncate">{c.title}</span>
                        <span className="shrink-0 text-xs tabular-nums text-ink-soft">
                          {s ? `${s.delivered} delivered · ${s.opened} opened${s.delivered ? ` (${Math.round((s.opened / s.delivered) * 100)}%)` : ""}` : "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
            <Panel title="Community participation" sub={`Last ${n} days`}>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-soft">Questions</dt>
                  <dd className="text-lg font-semibold">{d.community.posts}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-soft">Replies</dt>
                  <dd className="text-lg font-semibold">{d.community.replies}</dd>
                </div>
              </dl>
              <p className="mt-3 text-[0.6875rem] text-ink-soft">Shares: the app has no share button yet, so shares aren&apos;t measured.</p>
            </Panel>
          </div>
          <p className="text-[0.6875rem] text-ink-soft">{library.length} items are live in the app (Studio + built-in).</p>
        </>
      )}
    </div>
  );
}
