"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag, MessageCircle, Stethoscope, UserRound, VenetianMask } from "lucide-react";
import ReactionBar from "./ReactionBar";
import ReportSheet from "./ReportSheet";
import { timeAgo, topicLabel, type Author, type Post } from "@/lib/social/community";
import { useT } from "@/lib/i18n";

export function AuthorLine({ author, at, fixture, mine }: { author: Author; at: string; fixture?: boolean; mine?: boolean }) {
  const t = useT();
  const name = author.anonymous ? t("Anonymous member") : author.name;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-ink-soft">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-mint text-forest">
        {author.anonymous ? <VenetianMask size={11} /> : <UserRound size={11} />}
      </span>
      <span className="font-semibold text-ink">{mine ? t("{name} (you)", { name }) : name}</span>
      <span>· {timeAgo(at, new Date(), t.lang)}</span>
      {fixture && <span className="rounded-full bg-bg px-2 py-0.5 font-semibold ring-1 ring-line">{t("Sample")}</span>}
    </p>
  );
}

export default function PostCard({ post, replyCount }: { post: Post; replyCount: number }) {
  const [reporting, setReporting] = useState(false);
  const t = useT();
  return (
    <article className="rounded-3xl bg-surface p-4 ring-1 ring-line">
      <div className="flex items-start justify-between gap-2">
        <AuthorLine author={post.author} at={post.createdAt} fixture={post.fixture} mine={post.mine} />
        {!post.mine && (
          <button
            aria-label={t("Report post")}
            onClick={() => setReporting(true)}
            className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-ink-soft"
          >
            <Flag size={14} />
          </button>
        )}
      </div>

      <Link href={`/social/post/${post.id}`} className="mt-2 block">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-forest">
          {t(topicLabel(post.topic))}
          {post.pinned && <span className="rounded-full bg-mint px-2 py-0.5 normal-case tracking-normal text-forest-deep">{t("Pinned")}</span>}
          {post.featured && <span className="rounded-full bg-mint px-2 py-0.5 normal-case tracking-normal text-forest-deep">{t("Featured")}</span>}
          {post.status && post.status !== "visible" && <span className="rounded-full bg-amber-50 px-2 py-0.5 normal-case tracking-normal text-amber-900">{t("Hidden")}</span>}
        </p>
        <h3 className="mt-0.5 text-[15px] font-bold leading-snug">{post.title}</h3>
        {post.body && <p className="mt-1 line-clamp-3 text-sm text-ink-soft">{post.body}</p>}
        {post.wantsExpert && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-[11px] font-medium text-ink-soft ring-1 ring-line">
            <Stethoscope size={12} /> {t("Waiting for a verified expert")}
          </p>
        )}
      </Link>

      <div className="mt-3 flex items-center justify-between gap-2">
        <ReactionBar targetId={post.id} base={post.baseReactions} compact />
        <Link
          href={`/social/post/${post.id}`}
          className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-forest ring-1 ring-line"
        >
          <MessageCircle size={13} /> {replyCount ? t(replyCount === 1 ? "{n} reply" : "{n} replies", { n: replyCount }) : t("Reply")}
        </Link>
      </div>

      <ReportSheet targetId={post.id} type="post" open={reporting} onClose={() => setReporting(false)} />
    </article>
  );
}
