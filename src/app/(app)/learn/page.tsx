"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Check } from "lucide-react";
import { lessonsFrom } from "@/lib/feed/catalog";
import { useLibrary } from "@/lib/content/useLibrary";
import { useFeed } from "@/lib/feed/store";
import { useT } from "@/lib/i18n";

export default function LearnPage() {
  const feed = useFeed();
  const LESSONS = lessonsFrom(useLibrary().items);
  const t = useT();
  return (
    <div className="stagger space-y-4">
      <Link href="/man" className="tap-target flex items-center gap-1 text-sm text-ink-soft">
        <ArrowLeft size={16} /> {t("Man")}
      </Link>
      <h1 className="text-2xl font-bold">{t("Lessons")}</h1>
      {LESSONS.map((l) => (
        <Link key={l.id} href={`/learn/${l.id}`} className="block rounded-3xl bg-surface p-5 ring-1 ring-line">
          <p className="flex items-center gap-1.5 text-xs text-ink-soft">
            <BookOpen size={13} /> {t("{n} min", { n: l.minutes })} · {t(l.topic)}
            {feed.lessons[l.id] && (
              <span className="ml-auto flex items-center gap-1 font-semibold text-forest">
                <Check size={12} /> {t("Read")}
              </span>
            )}
          </p>
          <p className="mt-1 font-semibold">{t.lang === "sw" && l.titleSw ? l.titleSw : l.title}</p>
          <p className="mt-1 text-sm text-ink-soft">{t.lang === "sw" && l.summarySw ? l.summarySw : l.summary}</p>
        </Link>
      ))}
    </div>
  );
}
