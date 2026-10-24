"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Cover from "./Cover";
import BookmarkButton from "./BookmarkButton";
import type { ContentItem } from "@/lib/content/types";
import { useT } from "@/lib/i18n";
import { metaOf, titleOf } from "@/lib/content/display";
import { useContentLang } from "@/lib/me/contentLang";

export const contentHref = (id: string) => `/social/c/${id}`;

/** Small card for horizontal rows on Discover. */
export function ContentCard({ item, className = "w-44 shrink-0 snap-start" }: { item: ContentItem; className?: string }) {
  const t = useT();
  const cl = { lang: useContentLang() }; // Step 94: titles in the content language
  return (
    <Link
      href={contentHref(item.id)}
      className={`block overflow-hidden rounded-3xl bg-surface ring-1 ring-line transition-transform active:scale-[0.98] ${className}`}
    >
      <Cover item={item} className="h-24 w-full" />
      <div className="p-3">
        <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-forest">
          {metaOf(item, t)}
        </p>
        <p className="mt-1 line-clamp-3 text-[0.8125rem] font-semibold leading-snug">{titleOf(item, cl)}</p>
      </div>
    </Link>
  );
}

/** Row for lists: search results, saved, topic pages. With `reason`, it also says why it's suggested. */
export function ContentRow({ item, reason }: { item: ContentItem; reason?: string }) {
  const t = useT();
  const cl = { lang: useContentLang() }; // Step 94: titles in the content language
  return (
    <Link href={contentHref(item.id)} className="flex items-center gap-3 rounded-3xl bg-surface p-3 ring-1 ring-line">
      <Cover item={item} className="h-16 w-16 shrink-0 rounded-2xl" showPlay={false} />
      <div className="min-w-0 flex-1">
        <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-forest">
          {metaOf(item, t)}
        </p>
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{titleOf(item, cl)}</p>
        {reason && <p className="mt-0.5 truncate text-[0.6875rem] text-ink-soft">{reason}</p>}
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
  const t = useT();
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
          {t("See all")} <ChevronRight size={14} />
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
