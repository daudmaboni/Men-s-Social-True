"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Check } from "lucide-react";
import { LESSONS } from "@/lib/feed/catalog";
import { useFeed } from "@/lib/feed/store";

export default function LearnPage() {
  const feed = useFeed();
  return (
    <div className="stagger space-y-4">
      <Link href="/man" className="flex items-center gap-1 text-sm text-ink-soft">
        <ArrowLeft size={16} /> Man
      </Link>
      <h1 className="text-2xl font-bold">Lessons</h1>
      {LESSONS.map((l) => (
        <Link key={l.id} href={`/learn/${l.id}`} className="block rounded-3xl bg-surface p-5 ring-1 ring-line">
          <p className="flex items-center gap-1.5 text-xs text-ink-soft">
            <BookOpen size={13} /> {l.minutes} min · {l.topic}
            {feed.lessons[l.id] && (
              <span className="ml-auto flex items-center gap-1 font-semibold text-forest">
                <Check size={12} /> Read
              </span>
            )}
          </p>
          <p className="mt-1 font-semibold">{l.title}</p>
          <p className="mt-1 text-sm text-ink-soft">{l.summary}</p>
        </Link>
      ))}
    </div>
  );
}
