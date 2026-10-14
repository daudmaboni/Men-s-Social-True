"use client";

// Discover home — "show less, deliver more".
// The order, visibility, titles and staff picks of each section come from the live homepage layout
// (Admin → Homepage). Personalization stays: picks first, then what suits each man.
// 1. Featured insight · 2. For you · 3. Quick learning · 4. A question men often ask · 5. Explore all topics

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, MessageCircle, SlidersHorizontal } from "lucide-react";
import FeaturedCard from "./FeaturedCard";
import { ContentCard, ContentRow, contentHref } from "./ContentCards";
import InterestsSheet from "./InterestsSheet";
import { TOPICS } from "@/lib/content/library";
import type { Personal } from "@/lib/content/select";
import type { ContentItem } from "@/lib/content/types";
import { useLibrary } from "@/lib/content/useLibrary";
import { useSocial } from "@/lib/social/store";
import { useT } from "@/lib/i18n";
import { topicShort } from "@/lib/content/display";
import { resolveDiscover, wordsFor, type HomepageConfig, type SectionConfig } from "@/lib/homepage/config";
import { useHomepage } from "@/lib/homepage/useHomepage";

export function DiscoverSkeleton() {
  const t = useT();
  return (
    <div className="space-y-4" aria-busy="true" aria-label={t("Loading")}>
      <div className="h-[340px] animate-pulse rounded-[28px] bg-forest-deep/15" />
      <div className="h-5 w-40 animate-pulse rounded-full bg-line" />
      <div className="h-24 animate-pulse rounded-3xl bg-surface ring-1 ring-line" />
    </div>
  );
}

export default function Discover() {
  const { interests, bookmarks, history, ready } = useSocial();
  const { items } = useLibrary();
  const config = useHomepage();
  if (!ready) return <DiscoverSkeleton />;
  return <DiscoverView me={{ interests, bookmarks, history }} items={items} config={config} />;
}

/** The Discover page itself. Also used by Admin → Homepage to preview a layout before publishing. */
export function DiscoverView({ me, items, config, preview = false }: { me: Personal; items: ContentItem[]; config: HomepageConfig; preview?: boolean }) {
  const [pickTopics, setPickTopics] = useState(false);
  const t = useT();
  const lang = t.lang;
  const { featured, forYou, videos, question, tiles } = resolveDiscover(config, me, items);
  const title = (s: SectionConfig, fallback: string) => wordsFor(s.title, lang) ?? t(fallback);
  const sub = (s: SectionConfig, fallback: string) => wordsFor(s.subtitle, lang) ?? fallback;

  if (!featured && !forYou.length) {
    return (
      <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
        <p className="font-semibold">{t("No content yet")}</p>
        <p className="mt-1 text-sm text-ink-soft">{t("New guides and answers will appear here soon.")}</p>
      </div>
    );
  }

  const answerIntro = (lang === "sw" && question?.bodySw ? question.bodySw : question?.body)?.find((p) => !p.startsWith("## "));

  const render = (s: SectionConfig) => {
    if (!s.visible) return null;
    switch (s.id) {
      case "featured": {
        if (!featured) return null;
        const reason = wordsFor(s.subtitle, lang)
          ? wordsFor(s.subtitle, lang)!
          : featured.featured || s.items?.includes(featured.id)
            ? t("Chosen by our editors for you today.")
            : me.interests.includes(featured.topic)
              ? t("Picked for you because you follow {topic}.", { topic: topicShort(featured.topic, t) })
              : t("Picked by our editors as today's most useful read.");
        return <FeaturedCard key={s.id} item={featured} reason={reason} />;
      }
      case "for_you":
        if (!forYou.length) return null;
        return (
          <section key={s.id} aria-labelledby="sec-for-you" className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <h2 id="sec-for-you" className="text-base font-bold">
                  {title(s, "For you")}
                </h2>
                <p className="text-xs text-ink-soft">
                  {sub(
                    s,
                    me.interests.length
                      ? TOPICS.filter((x) => me.interests.includes(x.id)).map((x) => t(x.short)).join(" · ")
                      : t("Choose topics to make this yours"),
                  )}
                </p>
              </div>
              {!preview && (
                <button onClick={() => setPickTopics(true)} className="flex items-center gap-1 text-xs font-semibold text-forest">
                  <SlidersHorizontal size={14} /> {t(me.interests.length ? "Edit" : "Choose topics")}
                </button>
              )}
            </div>
            <div className="space-y-2.5">
              {forYou.map(({ item, why }) => (
                <ContentRow
                  key={item.id}
                  item={item}
                  reason={t(why.key, {
                    topic: why.key.includes("read about") ? topicShort(item.topic, t).toLowerCase() : topicShort(item.topic, t),
                  })}
                />
              ))}
            </div>
          </section>
        );
      case "videos":
        if (!videos.length) return null;
        return (
          <section key={s.id} aria-labelledby="sec-videos" className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <h2 id="sec-videos" className="text-base font-bold">
                  {title(s, "Quick learning")}
                </h2>
                <p className="text-xs text-ink-soft">{sub(s, t("Two minutes or less"))}</p>
              </div>
              <Link href="/social/topic/videos" className="flex items-center text-xs font-semibold text-forest">
                {t("All videos")} <ChevronRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {videos.map((v) => (
                <ContentCard key={v.id} item={v} className="w-full" />
              ))}
            </div>
          </section>
        );
      case "question":
        if (!question) return null;
        return (
          <section key={s.id} aria-labelledby="sec-question" className="rounded-3xl bg-mint/60 p-5">
            <p id="sec-question" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-forest">
              <MessageCircle size={13} /> {title(s, "A question men often ask")}
            </p>
            <p className="mt-2 text-lg font-bold leading-snug text-forest-deep">&ldquo;{question.question}&rdquo;</p>
            {answerIntro && <p className="mt-2 line-clamp-3 text-sm text-ink-soft">{answerIntro}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link href={contentHref(question.id)} className="flex items-center gap-1.5 rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-white">
                {t("Read the answer")} <ArrowRight size={14} />
              </Link>
              <Link href="/social?tab=community" className="rounded-full px-4 py-2.5 text-sm font-semibold text-forest ring-1 ring-line">
                {t("Ask your own question")}
              </Link>
            </div>
          </section>
        );
      case "topics":
        if (!tiles.length) return null;
        return (
          <section key={s.id} aria-labelledby="sec-topics" className="space-y-3">
            <div>
              <h2 id="sec-topics" className="text-base font-bold">
                {title(s, "Explore all topics")}
              </h2>
              <p className="text-xs text-ink-soft">{sub(s, t("Every guide, answer, video and tool"))}</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {tiles.map((tile) => (
                <Link
                  key={tile.id}
                  href={`/social/topic/${tile.id}`}
                  className={`flex min-h-[72px] flex-col justify-between rounded-2xl bg-surface p-3.5 ring-1 ring-line transition-transform active:scale-[0.98] ${
                    me.interests.includes(tile.id as never) ? "ring-forest" : ""
                  }`}
                >
                  <span className="text-sm font-semibold leading-snug">{t(tile.title)}</span>
                  <span className="mt-1 text-[11px] text-ink-soft">{t(tile.count === 1 ? "{n} item" : "{n} items", { n: tile.count })}</span>
                </Link>
              ))}
            </div>
          </section>
        );
    }
  };

  return (
    <div className="stagger space-y-7">
      {config.sections.map(render)}

      <p className="px-2 text-center text-[11px] leading-relaxed text-ink-soft">
        {t('All content here is general education, not medical advice. Items marked "Sample" are drafts that will be reviewed by a qualified health professional before launch.')}
      </p>

      {!preview && <InterestsSheet open={pickTopics} onClose={() => setPickTopics(false)} current={me.interests} />}
    </div>
  );
}
