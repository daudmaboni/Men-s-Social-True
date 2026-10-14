"use client";

// Content library: search, filter, sort, bulk actions, performance, and a publishing calendar.
// Every action goes through the content repo → Supabase, where the database checks the admin's role.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Plus, Search } from "lucide-react";
import Cover from "@/components/social/Cover";
import { useStudio } from "@/components/admin/AdminShell";
import { Badge, Confirm, Empty, ErrorBox, Loading, PageHeader, Segmented, btn, input } from "@/components/admin/ui";
import { useToast } from "@/components/motion/Toast";
import { LIBRARY, TOPICS } from "@/lib/content/library";
import { publishProblems } from "@/lib/studio/validate";
import { getContentRepo } from "@/lib/content/repo";
import { KIND_LABEL } from "@/lib/content/select";
import type { ContentItem, ContentKind, ContentStatus } from "@/lib/content/types";
import { displayStatus, STATUS_LABEL, STATUS_STYLE, type DisplayStatus } from "@/lib/admin/contentStatus";
import { select } from "@/lib/admin/api";

type Tab = "all" | DisplayStatus | "builtin";
type Stats = Record<string, { views: number; completes: number; saves: number }>;
const PAGE = 20;

export default function ContentList() {
  const studio = useStudio();
  const showToast = useToast();
  const canPublish = studio.can("content.publish");
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [kind, setKind] = useState<"all" | ContentKind>("all");
  const [topic, setTopic] = useState("all");
  const [since, setSince] = useState("all");
  const [sort, setSort] = useState<"updated" | "views" | "title">("updated");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<null | { action: ContentStatus | "delete"; label: string }>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const repo = getContentRepo();
    const load = () =>
      repo
        .listAll()
        .then((list) => {
          setItems(list);
          setError(null);
        })
        .catch((e: Error) => setError(e.message));
    void load();
    return repo.subscribe(load);
  }, []);

  // Performance (last 30 days), counted without knowing who viewed
  useEffect(() => {
    if (!studio.can("analytics.view")) return;
    const from = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    select<{ content_id: string; views: number; completes: number; saves: number }>("content_stats_daily", "content_id,views,completes,saves", (q) => q.gte("day", from))
      .then((rows) => {
        const s: Stats = {};
        for (const r of rows) {
          const t = (s[r.content_id] ??= { views: 0, completes: 0, saves: 0 });
          t.views += r.views;
          t.completes += r.completes;
          t.saves += r.saves;
        }
        setStats(s);
      })
      .catch(() => setStats(null)); // shown as "not tracked yet"
  }, [studio]);

  const mine = useMemo(() => new Set((items ?? []).map((c) => c.id)), [items]);
  const count = (s: DisplayStatus) => (items ?? []).filter((c) => displayStatus(c) === s).length;

  const shown = useMemo(() => {
    const list = tab === "builtin" ? LIBRARY.map((c) => ({ ...c, builtIn: true })) : (items ?? []).filter((c) => tab === "all" || displayStatus(c) === tab);
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const after = since === "all" ? 0 : Date.now() - Number(since) * 864e5;
    return list
      .filter((c) => (kind === "all" || c.kind === kind) && (topic === "all" || c.topic === topic))
      .filter((c) => !after || (c.updatedAt && new Date(c.updatedAt).getTime() >= after))
      .filter((c) => {
        const text = `${c.title} ${c.titleSw ?? ""} ${c.id} ${c.tags.join(" ")}`.toLowerCase();
        return words.every((w) => text.includes(w));
      })
      .sort((a, b) =>
        sort === "title"
          ? a.title.localeCompare(b.title)
          : sort === "views"
            ? (stats?.[b.id]?.views ?? 0) - (stats?.[a.id]?.views ?? 0)
            : (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
      );
  }, [items, tab, q, kind, topic, since, sort, stats]);

  useEffect(() => setPage(0), [tab, q, kind, topic, since, sort]);
  useEffect(() => setPicked(new Set()), [tab]);
  const pageItems = shown.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const pickedItems = (items ?? []).filter((c) => picked.has(c.id));

  async function runBulk() {
    if (!bulk) return;
    setBusy(true);
    const repo = getContentRepo();
    let ok = 0;
    const errors: string[] = [];
    for (const c of pickedItems) {
      try {
        if (bulk.action === "published" || bulk.action === "review") {
          const missing = publishProblems(c);
          if (missing.length) throw new Error(`not ready — ${missing[0]}`);
        }
        if (bulk.action === "delete") await repo.remove(c.id);
        else await repo.setStatus(c.id, bulk.action);
        ok++;
      } catch (e) {
        errors.push(`${c.title}: ${(e as Error).message}`);
      }
    }
    setBusy(false);
    setBulk(null);
    setPicked(new Set());
    showToast(errors.length ? `${ok} done, ${errors.length} not changed` : `${ok} ${ok === 1 ? "item" : "items"} updated`);
    if (errors.length) setError(errors.slice(0, 3).join(" · "));
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "all", label: `Yours (${items?.length ?? 0})` },
    { id: "draft", label: `Drafts (${count("draft")})` },
    { id: "review", label: `In review (${count("review")})` },
    { id: "scheduled", label: `Scheduled (${count("scheduled")})` },
    { id: "published", label: `Published (${count("published")})` },
    { id: "archived", label: `Archived (${count("archived")})` },
    { id: "builtin", label: `Built-in (${LIBRARY.length})` },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Content"
        sub={items === null ? "Loading…" : `${count("published")} live · ${count("review")} waiting for review · ${count("scheduled")} scheduled · ${LIBRARY.length} built-in`}
        actions={
          <>
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                { id: "list", label: "List" },
                { id: "calendar", label: "Calendar" },
              ]}
            />
            <Link href="/studio/edit" className={btn.primary}>
              <Plus size={16} /> New content
            </Link>
          </>
        }
      />

      {error && <ErrorBox error={error} onRetry={() => setError(null)} />}

      {view === "calendar" ? (
        <Calendar items={items ?? []} />
      ) : (
        <>
          {/* Filters: one row above the list */}
          <div className="space-y-3">
            <div className="flex gap-1 overflow-x-auto rounded-full bg-surface p-1 ring-1 ring-line [scrollbar-width:none]" role="tablist" aria-label="Status">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${tab === t.id ? "bg-forest-deep text-white" : "text-ink-soft"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
              <label className="flex items-center gap-2 rounded-xl bg-surface px-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-forest">
                <Search size={14} className="text-ink-soft" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, tags, addresses" aria-label="Search content" className="w-full bg-transparent py-2.5 text-sm outline-none" />
              </label>
              <select aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={input}>
                <option value="all">All types</option>
                {(Object.keys(KIND_LABEL) as ContentKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <select aria-label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} className={input}>
                <option value="all">All topics</option>
                {TOPICS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <select aria-label="Changed" value={since} onChange={(e) => setSince(e.target.value)} className={input}>
                <option value="all">Any date</option>
                <option value="7">Changed in 7 days</option>
                <option value="30">Changed in 30 days</option>
                <option value="90">Changed in 90 days</option>
              </select>
              <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={input}>
                <option value="updated">Newest change</option>
                <option value="views">Most viewed (30 days)</option>
                <option value="title">Title A–Z</option>
              </select>
            </div>
          </div>

          {tab === "builtin" && (
            <p className="rounded-2xl bg-mint/60 px-4 py-3 text-sm text-forest-deep">
              These came with the app (samples and the adapted Instagram posts). Open one to edit a copy. When you publish the copy, it replaces
              the built-in version for everyone.
            </p>
          )}

          {/* Bulk actions */}
          {picked.size > 0 && (
            <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-2xl bg-forest-deep px-4 py-2.5 text-sm text-white lg:top-2">
              <span className="mr-auto font-semibold">{picked.size} selected</span>
              <button className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold" onClick={() => setBulk({ action: "review", label: "Submit for review" })}>
                Submit for review
              </button>
              <button className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold" onClick={() => setBulk({ action: "draft", label: "Move to drafts" })}>
                Move to drafts
              </button>
              {canPublish && (
                <>
                  <button className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold" onClick={() => setBulk({ action: "published", label: "Publish" })}>
                    Publish
                  </button>
                  <button className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold" onClick={() => setBulk({ action: "archived", label: "Archive" })}>
                    Archive
                  </button>
                </>
              )}
              <button className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold" onClick={() => setBulk({ action: "delete", label: "Delete" })}>
                Delete
              </button>
              <button className="px-2 text-xs underline" onClick={() => setPicked(new Set())}>
                Clear
              </button>
            </div>
          )}

          {items === null && tab !== "builtin" && !error ? (
            <Loading />
          ) : shown.length === 0 ? (
            <div className="rounded-2xl bg-surface ring-1 ring-line">
              <Empty title={q || kind !== "all" || topic !== "all" || since !== "all" ? "Nothing matches these filters" : tab === "all" ? "You haven't written anything yet" : "Nothing here"}>
                {tab === "all" && !q ? "Press “New content” to write your first guide or article." : "Try clearing a filter."}
              </Empty>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
              <ul className="divide-y divide-line">
                {pageItems.map((c) => {
                  const ds = c.builtIn ? null : displayStatus(c);
                  const s = stats?.[c.id];
                  return (
                    <li key={c.id} className="flex items-center gap-3 p-3 pr-4 hover:bg-bg">
                      {!c.builtIn && (
                        <input
                          type="checkbox"
                          aria-label={`Select ${c.title}`}
                          className="h-4 w-4 shrink-0 accent-forest"
                          checked={picked.has(c.id)}
                          onChange={(e) =>
                            setPicked((p) => {
                              const n = new Set(p);
                              if (e.target.checked) n.add(c.id);
                              else n.delete(c.id);
                              return n;
                            })
                          }
                        />
                      )}
                      <Link href={`/studio/edit?id=${encodeURIComponent(c.id)}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <Cover item={c} className="hidden h-12 w-16 shrink-0 rounded-lg sm:block" showPlay={false} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{c.title}</p>
                          <p className="truncate text-xs text-ink-soft">
                            {KIND_LABEL[c.kind]} · {TOPICS.find((t) => t.id === c.topic)?.short}
                            {c.titleSw ? " · EN + SW" : ""}
                            {c.featured ? " · Pinned" : ""}
                            {c.aiGenerated ? " · AI-assisted" : ""}
                            {ds === "scheduled" && c.publishAt
                              ? ` · goes live ${new Date(c.publishAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                              : c.updatedAt
                                ? ` · changed ${new Date(c.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                                : ""}
                          </p>
                        </div>
                      </Link>
                      <span className="hidden w-28 shrink-0 text-right text-[11px] tabular-nums text-ink-soft md:block" title="Last 30 days: views · finished · saved">
                        {stats === null ? "—" : s ? `${s.views} · ${s.completes} · ${s.saves}` : "0 · 0 · 0"}
                      </span>
                      {c.builtIn ? (
                        <Badge>{mine.has(c.id) ? "Edited copy exists" : "Built-in"}</Badge>
                      ) : (
                        ds && <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${STATUS_STYLE[ds]}`}>{STATUS_LABEL[ds]}</span>
                      )}
                      <Link href={`/studio/edit?copy=${encodeURIComponent(c.id)}`} aria-label={`Duplicate ${c.title}`} title="Duplicate" className="hidden shrink-0 text-ink-soft hover:text-ink sm:block">
                        <Copy size={15} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-ink-soft">
                <span>
                  {shown.length} {shown.length === 1 ? "item" : "items"}
                  {stats !== null && <span className="hidden md:inline"> · numbers = views · finished · saved, last 30 days</span>}
                </span>
                <div className="flex items-center gap-2">
                  <button aria-label="Previous page" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-full p-1.5 ring-1 ring-line disabled:opacity-30">
                    <ChevronLeft size={14} />
                  </button>
                  <span>
                    Page {page + 1} of {pages}
                  </span>
                  <button aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="rounded-full p-1.5 ring-1 ring-line disabled:opacity-30">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <Confirm
        open={bulk !== null}
        title={`${bulk?.label} ${picked.size} ${picked.size === 1 ? "item" : "items"}?`}
        confirmLabel={bulk?.label ?? ""}
        danger={bulk?.action === "delete"}
        typeToConfirm={bulk?.action === "delete" ? "delete" : undefined}
        busy={busy}
        onConfirm={runBulk}
        onClose={() => setBulk(null)}
      >
        {bulk?.action === "published"
          ? "They go live for men now (items that aren't ready, or AI drafts not yet checked, will be refused by the database and listed)."
          : bulk?.action === "delete"
            ? "They're removed for good. This can't be undone."
            : bulk?.action === "archived"
              ? "They're taken out of the app but kept here."
              : "Their status changes. Nothing is deleted."}
      </Confirm>
    </div>
  );
}

/** Month calendar: what went live, and what's scheduled to go live. */
function Calendar({ items }: { items: ContentItem[] }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const start = new Date(month);
  start.setDate(1 - ((month.getDay() + 6) % 7)); // weeks start Monday
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const byDay = new Map<string, { c: ContentItem; scheduled: boolean }[]>();
  for (const c of items) {
    const ds = displayStatus(c);
    const when = ds === "scheduled" ? c.publishAt : ds === "published" ? c.publishedAt : undefined;
    if (!when) continue;
    const k = key(new Date(when));
    byDay.set(k, [...(byDay.get(k) ?? []), { c, scheduled: ds === "scheduled" }]);
  }
  const today = key(new Date());
  return (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
      <div className="mb-3 flex items-center justify-between">
        <button aria-label="Previous month" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className={btn.small}>
          <ChevronLeft size={14} />
        </button>
        <p className="flex items-center gap-2 text-sm font-bold">
          <CalendarDays size={16} /> {month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </p>
        <button aria-label="Next month" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className={btn.small}>
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-line text-xs ring-1 ring-line">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="bg-surface px-2 py-1.5 font-semibold text-ink-soft">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const list = byDay.get(key(d)) ?? [];
          const inMonth = d.getMonth() === month.getMonth();
          return (
            <div key={d.toISOString()} className={`min-h-20 bg-surface p-1.5 ${inMonth ? "" : "opacity-40"}`}>
              <p className={`mb-1 text-[11px] font-semibold ${key(d) === today ? "inline-block rounded-full bg-forest px-1.5 text-white" : "text-ink-soft"}`}>{d.getDate()}</p>
              <ul className="space-y-1">
                {list.slice(0, 3).map(({ c, scheduled }) => (
                  <li key={c.id}>
                    <Link
                      href={`/studio/edit?id=${encodeURIComponent(c.id)}`}
                      className={`block truncate rounded px-1 py-0.5 text-[10px] font-medium ${scheduled ? "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200" : "bg-mint text-forest-deep"}`}
                      title={`${scheduled ? "Scheduled" : "Published"}: ${c.title}`}
                    >
                      {c.title}
                    </Link>
                  </li>
                ))}
                {list.length > 3 && <li className="text-[10px] text-ink-soft">+{list.length - 3} more</li>}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-2 flex flex-wrap gap-3 text-[11px] text-ink-soft">
        <span className="flex items-center gap-1">
          <i className="inline-block h-2.5 w-2.5 rounded-sm bg-mint" /> Published
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-100" /> Scheduled
        </span>
        <span>To schedule, open an item and set &ldquo;Go live at&rdquo;.</span>
      </p>
    </div>
  );
}
