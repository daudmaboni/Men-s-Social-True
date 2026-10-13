"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag, MessageCircle, Stethoscope, UserRound, VenetianMask } from "lucide-react";
import ReactionBar from "./ReactionBar";
import ReportSheet from "./ReportSheet";
import { timeAgo, topicLabel, type Author, type Post } from "@/lib/social/community";

export function AuthorLine({ author, at, fixture, mine }: { author: Author; at: string; fixture?: boolean; mine?: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-ink-soft">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-mint text-forest">
        {author.anonymous ? <VenetianMask size={11} /> : <UserRound size={11} />}
      </span>
      <span className="font-semibold text-ink">{mine ? `${author.name} (you)` : author.name}</span>
      <span>· {timeAgo(at)}</span>
      {fixture && <span className="rounded-full bg-bg px-2 py-0.5 font-semibold ring-1 ring-line">Sample</span>}
    </p>
  );
}

export default function PostCard({ post, replyCount }: { post: Post; replyCount: number }) {
  const [reporting, setReporting] = useState(false);
  return (
    <article className="rounded-3xl bg-surface p-4 ring-1 ring-line">
      <div className="flex items-start justify-between gap-2">
        <AuthorLine author={post.author} at={post.createdAt} fixture={post.fixture} mine={post.mine} />
        {!post.mine && (
          <button
            aria-label="Report post"
            onClick={() => setReporting(true)}
            className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-ink-soft"
          >
            <Flag size={14} />
          </button>
        )}
      </div>

      <Link href={`/social/post/${post.id}`} className="mt-2 block">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-forest">{topicLabel(post.topic)}</p>
        <h3 className="mt-0.5 text-[15px] font-bold leading-snug">{post.title}</h3>
        {post.body && <p className="mt-1 line-clamp-3 text-sm text-ink-soft">{post.body}</p>}
        {post.wantsExpert && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-[11px] font-medium text-ink-soft ring-1 ring-line">
            <Stethoscope size={12} /> Waiting for a verified expert
          </p>
        )}
      </Link>

      <div className="mt-3 flex items-center justify-between gap-2">
        <ReactionBar targetId={post.id} base={post.baseReactions} compact />
        <Link
          href={`/social/post/${post.id}`}
          className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-forest ring-1 ring-line"
        >
          <MessageCircle size={13} /> {replyCount ? `${replyCount} ${replyCount === 1 ? "reply" : "replies"}` : "Reply"}
        </Link>
      </div>

      <ReportSheet targetId={post.id} open={reporting} onClose={() => setReporting(false)} />
    </article>
  );
}
