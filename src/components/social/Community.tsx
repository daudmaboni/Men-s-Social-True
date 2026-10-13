"use client";

import { useState } from "react";
import Link from "next/link";
import { PenLine, ShieldCheck, Stethoscope } from "lucide-react";
import PostCard from "./PostCard";
import ComposeSheet from "./ComposeSheet";
import { useCommunity } from "./useCommunity";
import { COMMUNITY_TOPICS } from "@/lib/social/community";

export function CommunitySkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-36 animate-pulse rounded-3xl bg-surface ring-1 ring-line" />
      ))}
    </div>
  );
}

export default function Community() {
  const c = useCommunity();
  const [topic, setTopic] = useState<string>("all");
  const [sort, setSort] = useState<"new" | "active">("active");
  const [asking, setAsking] = useState(false);

  if (!c.ready) return <CommunitySkeleton />;
  const items = c.list(sort, topic);

  return (
    <div className="space-y-4">
      {/* Ask */}
      <button
        onClick={() => setAsking(true)}
        className="flex w-full items-center gap-3 rounded-3xl bg-forest-deep p-4 text-left text-white transition-transform active:scale-[0.99]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
          <PenLine size={18} />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">Ask a question</span>
          <span className="block text-xs text-mint">Anonymous by default. Men here have been there too.</span>
        </span>
      </button>

      {/* Expert Q&A status — honest until verified professionals are onboarded */}
      <div className="flex items-start gap-3 rounded-2xl px-4 py-3 ring-1 ring-line">
        <Stethoscope size={18} className="mt-0.5 shrink-0 text-forest" />
        <p className="text-xs text-ink-soft">
          <span className="font-semibold text-ink">Expert Q&amp;A is coming.</span> Verified doctors aren&apos;t on the
          app yet. Questions marked for an expert are queued for when they join. Meanwhile, see{" "}
          <Link href="/social/topic/expert" className="font-semibold text-forest underline">
            Expert answers
          </Link>{" "}
          in Discover.
        </p>
      </div>

      {/* Topic filter + sort */}
      <div className="flex gap-2 overflow-x-auto rounded-full pb-1 [scrollbar-width:none]" role="tablist" aria-label="Topic">
        {[{ id: "all", label: "All" }, ...COMMUNITY_TOPICS].map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={topic === t.id}
            onClick={() => setTopic(t.id)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
              topic === t.id ? "bg-forest-deep text-white" : "bg-surface text-ink-soft ring-1 ring-line"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-soft">
          {items.length} {items.length === 1 ? "conversation" : "conversations"}
        </span>
        <div className="flex rounded-full bg-surface p-0.5 ring-1 ring-line">
          {(["active", "new"] as const).map((s) => (
            <button
              key={s}
              aria-pressed={sort === s}
              onClick={() => setSort(s)}
              className={`rounded-full px-3 py-1 font-semibold ${sort === s ? "bg-forest text-white" : "text-ink-soft"}`}
            >
              {s === "active" ? "Most active" : "Newest"}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      {items.length === 0 ? (
        <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
          <p className="font-semibold">No conversations here yet</p>
          <p className="mt-1 text-sm text-ink-soft">Be the first to ask. Anonymous is fine.</p>
          <button onClick={() => setAsking(true)} className="mt-4 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white">
            Ask a question
          </button>
        </div>
      ) : (
        <div className="stagger space-y-3">
          {items.map(({ post, replyCount }) => (
            <PostCard key={post.id} post={post} replyCount={replyCount} />
          ))}
        </div>
      )}

      <p className="flex items-start justify-center gap-1.5 px-2 text-center text-[11px] text-ink-soft">
        <ShieldCheck size={12} className="mt-px shrink-0" />
        Be kind. No selling, phone numbers or links. Posts marked &quot;Sample&quot; are examples. Until the server is
        connected, your posts are saved on this phone only.
      </p>

      <ComposeSheet open={asking} onClose={() => setAsking(false)} />
    </div>
  );
}
