"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Cover from "./Cover";
import BookmarkButton from "./BookmarkButton";
import { contentHref } from "./ContentCards";
import type { ContentItem } from "@/lib/content/types";
import { useT } from "@/lib/i18n";
import { ctaOf, metaOf, summaryOf, titleOf, topicShort } from "@/lib/content/display";

/** The one featured piece at the top of Discover — compact, so the sections below show on the first screen. */
export default function FeaturedCard({ item, reason }: { item: ContentItem; reason: string }) {
  const t = useT();
  const topic = topicShort(item.topic, t);
  const title = titleOf(item, t);
  return (
    <article className="overflow-hidden rounded-[28px] bg-forest-deep text-white">
      <Link href={contentHref(item.id)} className="relative block" aria-label={title}>
        <Cover item={item} className="aspect-[2/1] w-full" />
        <div className="absolute left-4 top-4 flex gap-2">
          <span className="rounded-full bg-white/90 px-3 py-1 text-[0.6875rem] font-bold text-forest-deep">{t("Featured")}</span>
          {item.fixture && (
            <span className="rounded-full bg-black/35 px-3 py-1 text-[0.6875rem] font-semibold text-white backdrop-blur">{t("Sample")}</span>
          )}
        </div>
      </Link>

      <div className="p-4">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-mint-strong">
          {topic} · {metaOf(item, t)}
        </p>
        <Link href={contentHref(item.id)}>
          <h2 className="mt-1.5 text-[1.25rem] font-bold leading-snug">{title}</h2>
        </Link>
        <p className="mt-1 line-clamp-2 text-sm text-mint">{summaryOf(item, t)}</p>

        <div className="mt-3 flex items-center gap-2">
          <Link
            href={contentHref(item.id)}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-2.5 text-sm font-bold text-forest-deep transition-transform active:scale-[0.98]"
          >
            {ctaOf(item, t)} <ArrowRight size={16} />
          </Link>
          <BookmarkButton contentId={item.id} variant="dark" />
        </div>
        <p className="mt-2 line-clamp-1 text-[0.6875rem] text-mint/70">{reason}</p>
      </div>
    </article>
  );
}
