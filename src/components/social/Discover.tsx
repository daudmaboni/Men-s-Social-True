"use client";

// Discover home — "show less, deliver more".
// 1. One featured insight (rotates daily, prefers what he hasn't read)
// 2. For you: 2–3 picks, each saying why it's suggested
// 3. Quick learning: one or two short videos
// 4. One question men often ask (with a way into Community)
// 5. Explore all topics: the full library, one tap away
// Everything else lives on the topic pages, so nothing is lost.

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, MessageCircle, SlidersHorizontal } from "lucide-react";
import FeaturedCard from "./FeaturedCard";
import { ContentCard, ContentRow, contentHref } from "./ContentCards";
import InterestsSheet from "./InterestsSheet";
import { TOPICS } from "@/lib/content/library";
import { featuredToday, questionToday, quickVideos, recommendations, topicTiles } from "@/lib/content/select";
import { useLibrary } from "@/lib/content/useLibrary";
import { useSocial } from "@/lib/social/store";

export function DiscoverSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-[340px] animate-pulse rounded-[28px] bg-forest-deep/15" />
      <div className="h-5 w-40 animate-pulse rounded-full bg-line" />
      <div className="h-24 animate-pulse rounded-3xl bg-surface ring-1 ring-line" />
    </div>
  );
}

export default function Discover() {
  const { interests, bookmarks, history, ready } = useSocial();
  const [pickTopics, setPickTopics] = useState(false);
  const { items } = useLibrary();

  if (!ready) return <DiscoverSkeleton />;

  const me = { interests, bookmarks, history };
  const featured = featuredToday(me, items);
  if (!featured) {
    return (
      <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
        <p className="font-semibold">No content yet</p>
        <p className="mt-1 text-sm text-ink-soft">New guides and answers will appear here soon.</p>
      </div>
    );
  }

  const followed = TOPICS.filter((t) => interests.includes(t.id) && t.id === featured.topic);
  const reason = followed.length
    ? `Picked for you because you follow ${followed[0].short}.`
    : "Picked by our editors as today's most useful read.";
  const picks = recommendations(me, items, [featured.id]);
  const videos = quickVideos(me, items);
  const question = questionToday(me, items);
  const tiles = topicTiles(items);
  const answerIntro = question?.body?.find((p) => !p.startsWith("## "));

  return (
    <div className="stagger space-y-7">
      <FeaturedCard item={featured} reason={reason} />

      {/* For you */}
      <section aria-labelledby="sec-for-you" className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 id="sec-for-you" className="text-base font-bold">For you</h2>
            <p className="text-xs text-ink-soft">
              {interests.length ? TOPICS.filter((t) => interests.includes(t.id)).map((t) => t.short).join(" · ") : "Choose topics to make this yours"}
            </p>
          </div>
          <button onClick={() => setPickTopics(true)} className="flex items-center gap-1 text-xs font-semibold text-forest">
            <SlidersHorizontal size={14} /> {interests.length ? "Edit" : "Choose topics"}
          </button>
        </div>
        <div className="space-y-2.5">
          {picks.map(({ item, reason }) => (
            <ContentRow key={item.id} item={item} reason={reason} />
          ))}
        </div>
      </section>

      {/* Quick learning */}
      {videos.length > 0 && (
        <section aria-labelledby="sec-videos" className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <h2 id="sec-videos" className="text-base font-bold">Quick learning</h2>
              <p className="text-xs text-ink-soft">Two minutes or less</p>
            </div>
            <Link href="/social/topic/videos" className="flex items-center text-xs font-semibold text-forest">
              All videos <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {videos.map((v) => (
              <ContentCard key={v.id} item={v} className="w-full" />
            ))}
          </div>
        </section>
      )}

      {/* One important question */}
      {question && (
        <section aria-labelledby="sec-question" className="rounded-3xl bg-mint/60 p-5">
          <p id="sec-question" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-forest">
            <MessageCircle size={13} /> A question men often ask
          </p>
          <p className="mt-2 text-lg font-bold leading-snug text-forest-deep">&ldquo;{question.question}&rdquo;</p>
          {answerIntro && <p className="mt-2 line-clamp-3 text-sm text-ink-soft">{answerIntro}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link href={contentHref(question.id)} className="flex items-center gap-1.5 rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-white">
              Read the answer <ArrowRight size={14} />
            </Link>
            <Link href="/social?tab=community" className="rounded-full px-4 py-2.5 text-sm font-semibold text-forest ring-1 ring-line">
              Ask your own question
            </Link>
          </div>
        </section>
      )}

      {/* Explore all topics */}
      <section aria-labelledby="sec-topics" className="space-y-3">
        <div>
          <h2 id="sec-topics" className="text-base font-bold">Explore all topics</h2>
          <p className="text-xs text-ink-soft">Every guide, answer, video and tool</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {tiles.map((t) => (
            <Link
              key={t.id}
              href={`/social/topic/${t.id}`}
              className={`flex min-h-[72px] flex-col justify-between rounded-2xl bg-surface p-3.5 ring-1 ring-line transition-transform active:scale-[0.98] ${
                interests.includes(t.id as never) ? "ring-forest" : ""
              }`}
            >
              <span className="text-sm font-semibold leading-snug">{t.title}</span>
              <span className="mt-1 text-[11px] text-ink-soft">
                {t.count} {t.count === 1 ? "item" : "items"}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <p className="px-2 text-center text-[11px] leading-relaxed text-ink-soft">
        All content here is general education, not medical advice. Items marked &quot;Sample&quot; are drafts that will be
        reviewed by a qualified health professional before launch.
      </p>

      <InterestsSheet open={pickTopics} onClose={() => setPickTopics(false)} current={interests} />
    </div>
  );
}
