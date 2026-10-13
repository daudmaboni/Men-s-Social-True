"use client";

import Link from "next/link";
import { ArrowLeft, Bookmark } from "lucide-react";
import { ContentRow } from "@/components/social/ContentCards";
import { LIBRARY } from "@/lib/content/library";
import { useSocial } from "@/lib/social/store";

export default function SavedPage() {
  const { bookmarks, ready } = useSocial();
  const items = Object.entries(bookmarks)
    .sort((a, b) => b[1].localeCompare(a[1])) // newest saved first
    .map(([id]) => LIBRARY.find((c) => c.id === id))
    .filter((c): c is (typeof LIBRARY)[number] => Boolean(c));

  return (
    <div className="stagger space-y-4">
      <Link href="/social" className="flex items-center gap-1 text-sm text-ink-soft">
        <ArrowLeft size={16} /> Social
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Saved</h1>
        <p className="mt-1 text-sm text-ink-soft">Saved on this phone. Only you can see this list.</p>
      </div>

      {!ready ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-3xl bg-surface ring-1 ring-line" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
          <Bookmark className="mx-auto text-forest" size={26} />
          <p className="mt-2 font-semibold">Nothing saved yet</p>
          <p className="mt-1 text-sm text-ink-soft">Tap the bookmark on any guide, video or answer to keep it here.</p>
          <Link href="/social" className="mt-4 inline-block rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white">
            Explore Discover
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <ContentRow key={c.id} item={c} />
          ))}
        </div>
      )}
    </div>
  );
}
