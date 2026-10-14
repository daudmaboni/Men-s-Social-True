"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ContentRow } from "@/components/social/ContentCards";
import { useLibrary } from "@/lib/content/useLibrary";
import { isSectionId, OPTIONAL_SECTIONS, sectionAll, SECTIONS } from "@/lib/content/select";
import { useT } from "@/lib/i18n";

export default function TopicPage() {
  const { id } = useParams<{ id: string }>();
  const valid = isSectionId(id);
  const library = useLibrary().items;
  const items = valid ? sectionAll(id, library) : [];
  const section = SECTIONS.find((s) => s.id === id);
  const t = useT();

  return (
    <div className="stagger space-y-4">
      <Link href="/social" className="flex items-center gap-1 text-sm text-ink-soft">
        <ArrowLeft size={16} /> {t("Discover")}
      </Link>

      {/* Category navigation */}
      <div className="flex gap-2 overflow-x-auto rounded-full pb-1 [scrollbar-width:none]">
        {SECTIONS.filter((s) => s.id === id || !OPTIONAL_SECTIONS.includes(s.id) || sectionAll(s.id, library).length > 0).map((s) => (
          <Link
            key={s.id}
            href={`/social/topic/${s.id}`}
            aria-current={s.id === id ? "page" : undefined}
            className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold ${
              s.id === id ? "bg-forest-deep text-white" : "bg-surface text-ink-soft ring-1 ring-line"
            }`}
          >
            {t(s.title)}
          </Link>
        ))}
      </div>

      {!valid ? (
        <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
          <p className="font-semibold">{t("Topic not found")}</p>
          <Link href="/social" className="mt-4 inline-block rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white">
            {t("Back to Discover")}
          </Link>
        </div>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-bold leading-tight">{t(section?.title ?? "")}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {t(items.length === 1 ? "{n} item" : "{n} items", { n: items.length })}
              {section?.blurb ? ` · ${t(section.blurb)}` : ""}
            </p>
          </div>
          {items.length === 0 ? (
            <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
              <p className="font-semibold">{t("Nothing here yet")}</p>
              <p className="mt-1 text-sm text-ink-soft">{t("New content for this topic is on the way.")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((c) => (
                <ContentRow key={c.id} item={c} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
