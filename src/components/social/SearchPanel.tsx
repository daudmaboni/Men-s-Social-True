"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { ContentRow } from "./ContentCards";
import PostCard from "./PostCard";
import { useCommunity } from "./useCommunity";
import { searchContent } from "@/lib/content/select";
import { topicLabel } from "@/lib/social/community";
import { TOPICS } from "@/lib/content/library";

const norm = (s: string) => s.toLowerCase();

/** Search Discover content or Community posts, depending on the tab he's on. */
export default function SearchPanel({ tab, onClose }: { tab: "discover" | "community"; onClose: () => void }) {
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const c = useCommunity();
  useEffect(() => input.current?.focus(), []);

  const words = norm(q).split(/\s+/).filter((w) => w.length > 1);
  const content = tab === "discover" ? searchContent(q) : [];
  const posts =
    tab === "community" && words.length
      ? c
          .list("active", "all")
          .filter(({ post }) => {
            const text = norm(`${post.title} ${post.body} ${topicLabel(post.topic)}`);
            return words.every((w) => text.includes(w));
          })
      : [];

  const results = tab === "discover" ? content.length : posts.length;

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
            placeholder={tab === "discover" ? "Search guides, answers, tools" : "Search conversations"}
            aria-label="Search"
            className="h-11 flex-1 bg-transparent text-sm outline-none"
          />
          {q && (
            <button aria-label="Clear search" onClick={() => setQ("")} className="text-ink-soft">
              <X size={16} />
            </button>
          )}
        </label>
        <button onClick={onClose} className="text-sm font-semibold text-forest">
          Cancel
        </button>
      </div>

      {!words.length ? (
        tab === "discover" ? (
          <div>
            <p className="text-xs font-semibold text-ink-soft">Try a topic</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[...TOPICS.map((t) => t.short), "Pelvic floor", "Fertility", "Sleep"].map((s) => (
                <button key={s} onClick={() => setQ(s)} className="rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-line">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Type a word, like &quot;nerves&quot; or &quot;walking&quot;.</p>
        )
      ) : results === 0 ? (
        <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
          <p className="font-semibold">No results for &quot;{q.trim()}&quot;</p>
          <p className="mt-1 text-sm text-ink-soft">
            {tab === "discover" ? "Try a simpler word, or browse the topics." : "Try another word, or ask the community."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-ink-soft" aria-live="polite">
            {results} {results === 1 ? "result" : "results"}
          </p>
          {tab === "discover"
            ? content.map((item) => <ContentRow key={item.id} item={item} />)
            : posts.map(({ post, replyCount }) => <PostCard key={post.id} post={post} replyCount={replyCount} />)}
        </div>
      )}
    </div>
  );
}
