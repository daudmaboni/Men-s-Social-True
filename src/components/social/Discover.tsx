"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import FeaturedCard from "./FeaturedCard";
import { SectionRow } from "./ContentCards";
import InterestsSheet from "./InterestsSheet";
import { LIBRARY, TOPICS } from "@/lib/content/library";
import { orderSections, pickFeatured, sectionItems } from "@/lib/content/select";
import { useSocial } from "@/lib/social/store";

export function DiscoverSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-[460px] animate-pulse rounded-[28px] bg-forest-deep/15" />
      <div className="h-5 w-40 animate-pulse rounded-full bg-line" />
      <div className="flex gap-3">
        <div className="h-44 w-44 animate-pulse rounded-3xl bg-surface ring-1 ring-line" />
        <div className="h-44 w-44 animate-pulse rounded-3xl bg-surface ring-1 ring-line" />
      </div>
    </div>
  );
}

export default function Discover() {
  const { interests, ready } = useSocial();
  const [pickTopics, setPickTopics] = useState(false);

  if (!ready) return <DiscoverSkeleton />;

  const featured = pickFeatured(interests, LIBRARY);
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
    ? `Picked for you because you follow ${followed[0].title}.`
    : "Picked by our editors as this week's most useful read.";

  return (
    <div className="stagger space-y-7">
      <FeaturedCard item={featured} reason={reason} />

      {/* Personalise */}
      <button
        onClick={() => setPickTopics(true)}
        className="flex w-full items-center justify-between rounded-2xl bg-mint/60 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-forest-deep">
            {interests.length ? `Following ${interests.length} ${interests.length === 1 ? "topic" : "topics"}` : "Make Discover yours"}
          </span>
          <span className="block text-xs text-forest">
            {interests.length
              ? TOPICS.filter((t) => interests.includes(t.id)).map((t) => t.short).join(" · ")
              : "Choose the topics you care about"}
          </span>
        </span>
        <SlidersHorizontal size={18} className="shrink-0 text-forest" />
      </button>

      {orderSections(interests).map((s) => (
        <SectionRow key={s.id} id={s.id} title={s.title} blurb={s.blurb} items={sectionItems(s.id, featured.id)} />
      ))}

      <p className="px-2 text-center text-[11px] leading-relaxed text-ink-soft">
        All content here is general education, not medical advice. Items marked &quot;Sample&quot; are drafts that will be
        reviewed by a qualified health professional before launch.
      </p>

      <InterestsSheet open={pickTopics} onClose={() => setPickTopics(false)} current={interests} />
    </div>
  );
}
