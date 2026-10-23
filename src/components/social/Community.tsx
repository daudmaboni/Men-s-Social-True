"use client";

import { useState } from "react";
import Link from "next/link";
import { PenLine, ShieldCheck, Stethoscope } from "lucide-react";
import PostCard from "./PostCard";
import ComposeSheet from "./ComposeSheet";
import { useCommunity } from "./useCommunity";
import { COMMUNITY_TOPICS } from "@/lib/social/community";
import { useT } from "@/lib/i18n";

export function CommunitySkeleton() {
  const t = useT();
  return (
    <div className="space-y-3" aria-busy="true" aria-label={t("Loading")}>
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
  const t = useT();

  if (!c.ready) return <CommunitySkeleton />;
  if (!c.enabled)
    return (
      <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
        <p className="font-semibold">{t("Community is paused right now.")}</p>
        <p className="mt-1 text-sm text-ink-soft">{t("Please check back soon. Discover is still open.")}</p>
      </div>
    );
  const items = c.list(sort, topic);

  // Phone: one column. Computer: the conversations on the left, "Ask", the expert note and the rules
  // in a column on the right that stays in view. The `order-*` classes keep the phone order the same.
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-6">
      <div className="contents lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:gap-4">
        {/* Topic filter + sort */}
        <div className="edge-pad order-3 flex gap-2 overflow-x-auto lg:flex-wrap lg:overflow-visible rounded-full pb-1 [scrollbar-width:none]" role="tablist" aria-label={t("Topic")}>
          {[{ id: "all", label: "All" }, ...COMMUNITY_TOPICS].map((x) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={topic === x.id}
              onClick={() => setTopic(x.id)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                topic === x.id ? "bg-forest-deep text-white" : "bg-surface text-ink-soft ring-1 ring-line"
              }`}
            >
              {t(x.label)}
            </button>
          ))}
        </div>
        <div className="edge-pad order-4 flex items-center justify-between text-xs">
          <span className="text-ink-soft">
            {t(items.length === 1 ? "{n} conversation" : "{n} conversations", { n: items.length })}
          </span>
          <div className="flex rounded-full bg-surface p-0.5 ring-1 ring-line">
            {(["active", "new"] as const).map((s) => (
              <button
                key={s}
                aria-pressed={sort === s}
                onClick={() => setSort(s)}
                className={`rounded-full px-3 py-1 font-semibold ${sort === s ? "bg-forest text-white" : "text-ink-soft"}`}
              >
                {t(s === "active" ? "Most active" : "Newest")}
              </button>
            ))}
          </div>
        </div>
        {/* Feed */}
        {items.length === 0 ? (
          <div className="order-5 rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
            <p className="font-semibold">{t("No conversations here yet")}</p>
            <p className="mt-1 text-sm text-ink-soft">{t("Be the first to ask. Anonymous is fine.")}</p>
            <button onClick={() => setAsking(true)} className="mt-4 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white">
              {t("Ask a question")}
            </button>
          </div>
        ) : (
          <div className="stagger order-5 space-y-3">
            {items.map(({ post, replyCount }) => (
              <PostCard key={post.id} post={post} replyCount={replyCount} />
            ))}
          </div>
        )}
      </div>

      <div className="contents lg:sticky lg:top-0 lg:col-start-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-4">
        {/* Ask */}
        <button
          onClick={() => setAsking(true)}
          className="order-1 flex w-full items-center gap-3 rounded-3xl bg-forest-deep p-4 text-left text-white transition-transform active:scale-[0.99]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
            <PenLine size={18} />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">{t("Ask a question")}</span>
            <span className="block text-xs text-mint">{t("Anonymous by default. Men here have been there too.")}</span>
          </span>
        </button>
        {/* Expert Q&A status — honest until verified professionals are onboarded */}
        <div className="order-2 flex items-start gap-3 rounded-2xl px-4 py-3 ring-1 ring-line">
          <Stethoscope size={18} className="mt-0.5 shrink-0 text-forest" />
          <p className="text-xs text-ink-soft">
            <span className="font-semibold text-ink">{t("Expert Q&A is coming.")}</span>{" "}
            {t("Verified doctors aren't on the app yet. Questions marked for an expert are queued for when they join. Meanwhile, see")}{" "}
            <Link href="/social/topic/expert" className="font-semibold text-forest underline">
              {t("Expert answers")}
            </Link>{" "}
            {t("in Discover.")}
          </p>
        </div>
        <p className="order-6 flex items-start justify-center gap-1.5 px-2 text-center lg:justify-start lg:text-left text-[0.6875rem] text-ink-soft">
          <ShieldCheck size={12} className="mt-px shrink-0" />
          {c.mode === "server"
            ? t("Be kind. No selling, phone numbers or links. Posts are shared with all members and checked by our moderators.")
            : t('Be kind. No selling, phone numbers or links. Posts marked "Sample" are examples. Until the server is connected, your posts are saved on this phone only.')}
        </p>
      </div>

      <ComposeSheet open={asking} onClose={() => setAsking(false)} />
    </div>
  );
}
