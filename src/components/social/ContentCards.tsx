"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Cover from "./Cover";
import BookmarkButton from "./BookmarkButton";
import { KIND_LABEL } from "@/lib/content/select";
import type { ContentItem } from "@/lib/content/types";

export const contentHref = (id: string) => `/social/c/${id}`;

/** Small card for horizontal rows on Discover. */
export function ContentCard({ item }: { item: ContentItem }) {
  return (
    <Link
      href={contentHref(item.id)}
      className="block w-44 shrink-0 snap-start overflow-hidden rounded-3xl bg-surface ring-1 ring-line transition-transform active:scale-[0.98]"
    >
      <Cover item={item} className="h-24 w-full" />
      <div className="p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-forest">
          {KIND_LABEL[item.kind]} · {item.minutes} min
        </p>
        <p className="mt-1 line-clamp-3 text-[13px] font-semibold leading-snug">{item.title}</p>
      </div>
    </Link>
  );
}

/** Row for lists: search results, saved, topic pages. */
export function ContentRow({ item }: { item: ContentItem }) {
  return (
    <Link href={contentHref(item.id)} className="flex items-center gap-3 rounded-3xl bg-surface p-3 ring-1 ring-line">
      <Cover item={item} className="h-16 w-16 shrink-0 rounded-2xl" showPlay={false} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-forest">
          {KIND_LABEL[item.kind]} · {item.minutes} min
        </p>
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{item.title}</p>
      </div>
      <BookmarkButton contentId={item.id} variant="plain" />
    </Link>
  );
}

/** A Discover section: title, "See all", and a horizontal row of cards. */
export function SectionRow({
  id,
  title,
  blurb,
  items,
}: {
  id: string;
  title: string;
  blurb?: string;
  items: ContentItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={`sec-${id}`}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id={`sec-${id}`} className="text-base font-bold">
            {title}
          </h2>
          {blurb && <p className="text-xs text-ink-soft">{blurb}</p>}
        </div>
        <Link href={`/social/topic/${id}`} className="flex shrink-0 items-center text-xs font-semibold text-forest">
          See all <ChevronRight size={14} />
        </Link>
      </div>
      <div className="mt-3 flex snap-x gap-3 overflow-x-auto rounded-3xl pb-1 [scrollbar-width:none]">
        {items.map((c) => (
          <ContentCard key={c.id} item={c} />
        ))}
      </div>
    </section>
  );
}
