"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import Cover from "./Cover";
import BookmarkButton from "./BookmarkButton";
import { contentHref } from "./ContentCards";
import { CTA_LABEL, KIND_LABEL } from "@/lib/content/select";
import { TOPICS } from "@/lib/content/library";
import type { ContentItem } from "@/lib/content/types";

/** The one big piece of content at the top of Discover. */
export default function FeaturedCard({ item, reason }: { item: ContentItem; reason: string }) {
  const topic = TOPICS.find((t) => t.id === item.topic)?.title;
  return (
    <article className="overflow-hidden rounded-[28px] bg-forest-deep text-white">
      <Link href={contentHref(item.id)} className="block" aria-label={item.title}>
        <div className="relative">
          <Cover item={item} className="aspect-[4/3] w-full" />
          <div className="absolute left-4 top-4 flex gap-2">
            <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-forest-deep">Featured</span>
            {item.fixture && (
              <span className="rounded-full bg-black/35 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
                Sample content
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-mint-strong">
          {topic} · {KIND_LABEL[item.kind]} · {item.minutes} min read
        </p>
        <Link href={contentHref(item.id)}>
          <h2 className="mt-2 text-[24px] font-bold leading-tight">{item.title}</h2>
        </Link>
        <p className="mt-2 text-sm leading-relaxed text-mint">{item.summary}</p>

        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-mint/80">
          <ShieldCheck size={13} className="mt-px shrink-0" />
          {item.source}
        </p>

        <div className="mt-4 flex items-center gap-2">
          <Link
            href={contentHref(item.id)}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-bold text-forest-deep transition-transform active:scale-[0.98]"
          >
            {CTA_LABEL[item.kind]} <ArrowRight size={16} />
          </Link>
          <BookmarkButton contentId={item.id} variant="dark" />
        </div>
        <p className="mt-3 text-[11px] text-mint/70">{reason}</p>
      </div>
    </article>
  );
}
