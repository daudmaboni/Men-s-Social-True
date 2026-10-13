"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Search } from "lucide-react";
import Cover from "@/components/social/Cover";
import { LIBRARY, TOPICS } from "@/lib/content/library";
import { getContentRepo } from "@/lib/content/repo";
import { KIND_LABEL } from "@/lib/content/select";
import type { ContentItem, ContentStatus } from "@/lib/content/types";
import { Notice } from "./StudioGate";

type Tab = "all" | ContentStatus | "builtin";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "Yours" },
  { id: "draft", label: "Drafts" },
  { id: "published", label: "Published" },
  { id: "archived", label: "Archived" },
  { id: "builtin", label: "Built-in" },
];

export const STATUS_STYLE: Record<ContentStatus, string> = {
  draft: "bg-amber-50 text-amber-800 ring-amber-200",
  published: "bg-mint text-forest-deep ring-mint-strong/40",
  archived: "bg-bg text-ink-soft ring-line",
};

export default function ContentList() {
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");

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

  const mine = useMemo(() => new Set((items ?? []).map((c) => c.id)), [items]);
  const count = (s: ContentStatus) =>
    (items ?? []).filter((c) => c.status === s).length;

  const shown = useMemo(() => {
    const list =
      tab === "builtin"
        ? LIBRARY.map((c) => ({ ...c, builtIn: true }))
        : (items ?? []).filter((c) => tab === "all" || c.status === tab);
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return list.filter((c) => {
      const text =
        `${c.title} ${c.titleSw ?? ""} ${c.id} ${c.tags.join(" ")}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [items, tab, q]);

  return (
    <div className="stagger space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Content</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {items === null
              ? "Loading…"
              : `${count("published")} published · ${count("draft")} drafts · ${LIBRARY.length} built-in`}
          </p>
        </div>
        <Link
          href="/studio/edit"
          className="flex items-center gap-1.5 rounded-full bg-forest px-5 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
        >
          <Plus size={16} /> New content
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 overflow-x-auto rounded-full bg-surface p-1 ring-1 ring-line [scrollbar-width:none]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                tab === t.id ? "bg-forest-deep text-white" : "text-ink-soft"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-full bg-surface px-4 py-2 ring-1 ring-line focus-within:ring-2 focus-within:ring-forest">
          <Search size={14} className="text-ink-soft" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles and tags"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      {tab === "builtin" && (
        <p className="rounded-2xl bg-mint/60 px-4 py-3 text-sm text-forest-deep">
          These came with the app (samples and the adapted Instagram posts).
          Open one to edit a copy. When you publish the copy, it replaces the
          built-in version for everyone.
        </p>
      )}

      {error && <Notice title="Couldn't load content">{error}</Notice>}

      {items === null && tab !== "builtin" && !error ? (
        <div className="flex justify-center py-16 text-ink-soft">
          <Loader2 className="animate-spin" />
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-3xl bg-surface p-10 text-center ring-1 ring-line">
          <p className="font-semibold">
            {q
              ? "Nothing matches that search"
              : tab === "all"
                ? "You haven't written anything yet"
                : "Nothing here"}
          </p>
          {tab === "all" && !q && (
            <p className="mt-1 text-sm text-ink-soft">
              Press &ldquo;New content&rdquo; to write your first guide or
              article.
            </p>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
          {shown.map((c) => (
            <li key={c.id}>
              <Link
                href={`/studio/edit?id=${encodeURIComponent(c.id)}`}
                className="flex items-center gap-4 p-3 pr-5 hover:bg-bg"
              >
                <Cover
                  item={c}
                  className="h-14 w-20 shrink-0 rounded-xl"
                  showPlay={false}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.title}</p>
                  <p className="truncate text-xs text-ink-soft">
                    {KIND_LABEL[c.kind]} ·{" "}
                    {TOPICS.find((t) => t.id === c.topic)?.title}
                    {c.titleSw ? " · EN + SW" : ""}
                    {c.updatedAt
                      ? ` · ${new Date(c.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                      : ""}
                  </p>
                </div>
                {c.builtIn ? (
                  <span className="shrink-0 rounded-full bg-bg px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-line">
                    {mine.has(c.id) ? "Edited copy exists" : "Built-in"}
                  </span>
                ) : (
                  c.status && (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ${STATUS_STYLE[c.status]}`}
                    >
                      {c.status}
                    </span>
                  )
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
