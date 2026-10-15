"use client";

// Discover home — "show less, deliver more".
// The order, visibility, titles and staff picks of each section come from the live homepage layout
// (Admin → Homepage). Personalization stays: picks first, then what suits each man.
// 1. Featured insight · 2. For you · 3. Quick learning · 4. A question men often ask · 5. Explore all topics

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronRight, MessageCircle, SlidersHorizontal } from "lucide-react";
import FeaturedCard from "./FeaturedCard";
import SwipeRow from "@/components/motion/SwipeRow";
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
  const [topicsOpen, setTopicsOpen] = useState(false);
  const topicsRef = useRef<HTMLElement>(null);

  // The open topics list folds itself away once he has scrolled on and most of it is off the screen
  // (and its heading is out of view). The page doesn't jump: if the list was above, the scroll is corrected.
  useEffect(() => {
    if (!topicsOpen || preview) return;
    const el = topicsRef.current;
    if (!el) return;
    const scroller = scrollParent(el);
    const target: EventTarget = scroller === document.scrollingElement ? window : scroller;
    let frame = 0;
    const check = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vp = scroller === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect();
      const head = (el.firstElementChild as HTMLElement | null)?.getBoundingClientRect();
      const headSeen = head ? head.bottom > vp.top && head.top < vp.bottom : true;
      const seen = Math.max(0, Math.min(r.bottom, vp.bottom) - Math.max(r.top, vp.top));
      if (headSeen || seen / r.height >= 0.25) return;
      const before = el.offsetHeight;
      const above = r.top < vp.top;
      el.querySelector<HTMLElement>(".expand")?.setAttribute("data-instant", "true");
      flushSync(() => setTopicsOpen(false));
      if (above) scroller.scrollTop -= before - el.offsetHeight;
      requestAnimationFrame(() => el.querySelector<HTMLElement>(".expand")?.removeAttribute("data-instant"));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [topicsOpen, preview]);
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

  // On a computer the sections sit in two columns (the big video row and the note go across both).
  // The Studio's phone preview always stays one column.
  const desk = preview ? "" : "lg:grid lg:grid-flow-row-dense lg:grid-cols-2 lg:items-start lg:gap-x-6 lg:gap-y-8 lg:space-y-0";
  const full = preview ? "" : "lg:col-span-2";

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
        // The featured piece first, then the next most useful guides and articles he hasn't got below.
        // He swipes through them one at a time.
        const shown = new Set([featured.id, ...forYou.map((f) => f.item.id), question?.id]);
        const more = items
          .filter((c) => !shown.has(c.id) && (c.kind === "guide" || c.kind === "article") && !me.history[c.id])
          .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
          .slice(0, 4);
        return (
          <div key={s.id}>
            <SwipeRow id="discover-featured" hint={t("Swipe to see more articles")} label={t("Featured")} slideClass="w-[calc(100%-0.5rem)] lg:w-[calc(100%-2.5rem)]">
              {[featured, ...more].map((c, i) => (
                <FeaturedCard key={c.id} item={c} reason={i === 0 ? reason : t("Also worth reading today.")} />
              ))}
            </SwipeRow>
          </div>
        );
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
          <section key={s.id} aria-labelledby="sec-videos" className={`space-y-3 ${full}`}>
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
            <div className={`grid grid-cols-2 gap-3 ${preview ? "" : "lg:grid-cols-4 lg:gap-4"}`}>
              {videos.map((v) => (
                <ContentCard key={v.id} item={v} className="w-full" />
              ))}
            </div>
          </section>
        );
      case "question":
        if (!question) return null;
        return (
          <section key={s.id} aria-labelledby="sec-question" className={`rounded-3xl bg-mint/60 p-5 ${preview ? "" : "lg:p-7"}`}>
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
          <section key={s.id} ref={topicsRef} aria-labelledby="sec-topics" className="rounded-3xl bg-surface ring-1 ring-line">
            {/* Closed by default so the page stays short; tap to open the list */}
            <button
              onClick={() => setTopicsOpen((o) => !o)}
              aria-expanded={topicsOpen}
              aria-controls="topics-list"
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
            >
              <span>
                <span id="sec-topics" className="block text-base font-bold">
                  {title(s, "Explore all topics")}
                </span>
                <span className="block text-xs text-ink-soft">
                  {sub(s, t("Every guide, answer, video and tool"))} · {t("{n} topics", { n: tiles.length })}
                </span>
              </span>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint text-forest transition-transform duration-300 ${topicsOpen ? "rotate-180" : ""}`}>
                <ChevronDown size={18} aria-hidden />
              </span>
            </button>
            <div id="topics-list" className="expand" data-open={topicsOpen}>
              <div>
                <ul className="space-y-1 px-2 pb-2">
                  {tiles.map((tile, i) => (
                    // Each row unfolds like a folded paper opening, one after another
                    <li key={tile.id} className="fold-row" style={{ "--i": i } as React.CSSProperties}>
                      <Link
                        href={`/social/topic/${tile.id}`}
                        tabIndex={topicsOpen ? 0 : -1}
                        className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-mint/50 active:bg-mint/70"
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          {me.interests.includes(tile.id as never) && <span className="h-2 w-2 rounded-full bg-forest" aria-hidden />}
                          {t(tile.title)}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-ink-soft">
                          {t(tile.count === 1 ? "{n} item" : "{n} items", { n: tile.count })}
                          <ChevronRight size={14} aria-hidden />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        );
    }
  };

  return (
    <div className={`stagger space-y-7 ${desk}`}>
      {config.sections.map(render)}

      <p className={`px-2 text-center text-[11px] leading-relaxed text-ink-soft ${full}`}>
        {t('All content here is general education, not medical advice. Items marked "Sample" are drafts that will be reviewed by a qualified health professional before launch.')}
      </p>

      {!preview && <InterestsSheet open={pickTopics} onClose={() => setPickTopics(false)} current={me.interests} />}
    </div>
  );
}

/** The element that scrolls this part of the page (a tab panel, or the page itself). */
function scrollParent(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const y = getComputedStyle(p).overflowY;
    if ((y === "auto" || y === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}
