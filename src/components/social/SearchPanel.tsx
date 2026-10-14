"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { ContentRow } from "./ContentCards";
import PostCard from "./PostCard";
import { useCommunity } from "./useCommunity";
import { searchContent } from "@/lib/content/select";
import { useLibrary } from "@/lib/content/useLibrary";
import { topicLabel } from "@/lib/social/community";
import { TOPICS } from "@/lib/content/library";
import { useT } from "@/lib/i18n";
import { trackSearch } from "@/lib/analytics/track";

const norm = (s: string) => s.toLowerCase();

/** Search Discover content or Community posts, depending on the tab he's on. */
export default function SearchPanel({ tab, onClose }: { tab: "discover" | "community"; onClose: () => void }) {
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const c = useCommunity();
  const library = useLibrary().items;
  const t = useT();
  useEffect(() => input.current?.focus(), []);

  const words = norm(q).split(/\s+/).filter((w) => w.length > 1);
  const content = tab === "discover" ? searchContent(q, library) : [];
  const posts =
    tab === "community" && words.length
      ? c
          .list("active", "all")
          .filter(({ post }) => {
            const text = norm(`${post.title} ${post.body} ${topicLabel(post.topic)} ${t(topicLabel(post.topic))}`);
            return words.every((w) => text.includes(w));
          })
      : [];

  const results = tab === "discover" ? content.length : posts.length;
  // Count what men search for (and what finds nothing), so staff know what content to write
  useEffect(() => {
    if (tab === "discover") trackSearch(q, results);
  }, [q, results, tab]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-full bg-surface px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-forest">
          <Search size={16} className="text-ink-soft" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
            placeholder={t(tab === "discover" ? "Search guides, answers, tools" : "Search conversations")}
            aria-label={t("Search")}
            className="h-11 flex-1 bg-transparent text-sm outline-none"
          />
          {q && (
            <button aria-label={t("Clear search")} onClick={() => setQ("")} className="text-ink-soft">
              <X size={16} />
            </button>
          )}
        </label>
        <button onClick={onClose} className="text-sm font-semibold text-forest">
          {t("Cancel")}
        </button>
      </div>

      {!words.length ? (
        tab === "discover" ? (
          <div>
            <p className="text-xs font-semibold text-ink-soft">{t("Try a topic")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[...new Set([...TOPICS.map((x) => x.short), "Pelvic floor", "Sleep"])].map((s) => (
                <button key={s} onClick={() => setQ(t(s))} className="rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-line">
                  {t(s)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">{t('Type a word, like "nerves" or "walking".')}</p>
        )
      ) : results === 0 ? (
        <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
          <p className="font-semibold">{t('No results for "{q}"', { q: q.trim() })}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {t(tab === "discover" ? "Try a simpler word, or browse the topics." : "Try another word, or ask the community.")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-ink-soft" aria-live="polite">
            {t(results === 1 ? "{n} result" : "{n} results", { n: results })}
          </p>
          {tab === "discover"
            ? content.map((item) => <ContentRow key={item.id} item={item} />)
            : posts.map(({ post, replyCount }) => <PostCard key={post.id} post={post} replyCount={replyCount} />)}
        </div>
      )}
    </div>
  );
}
