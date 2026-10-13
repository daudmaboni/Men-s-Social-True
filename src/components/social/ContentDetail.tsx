"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, MessageCircle, PlayCircle, ShieldCheck } from "lucide-react";
import Cover from "./Cover";
import BookmarkButton from "./BookmarkButton";
import { ContentRow } from "./ContentCards";
import { DoctorCheck, PelvicFloorTrainer, QuizRunner } from "./ContentTools";
import { useToast } from "@/components/motion/Toast";
import { LIBRARY, TOPICS } from "@/lib/content/library";
import { getContent, KIND_LABEL } from "@/lib/content/select";
import { feedStore, useFeed } from "@/lib/feed/store";

/** Full page for any piece of content: guide, article, video, quiz, tool or expert answer. */
export default function ContentDetail({ id, back }: { id: string; back: { href: string; label: string } }) {
  const item = getContent(id);
  const feed = useFeed();
  const showToast = useToast();
  const [lang, setLang] = useState<"en" | "sw">("en");

  if (!item) {
    return (
      <div className="space-y-4">
        <Link href={back.href} className="flex items-center gap-1 text-sm text-ink-soft">
          <ArrowLeft size={16} /> {back.label}
        </Link>
        <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
          <p className="font-semibold">This content isn&apos;t available</p>
          <p className="mt-1 text-sm text-ink-soft">It may have been moved or removed.</p>
          <Link href="/social" className="mt-4 inline-block rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white">
            Go to Discover
          </Link>
        </div>
      </div>
    );
  }

  const topic = TOPICS.find((t) => t.id === item.topic);
  const sw = lang === "sw" && Boolean(item.bodySw);
  const title = sw && item.titleSw ? item.titleSw : item.title;
  const body = sw ? item.bodySw : item.body;
  const read = Boolean(feed.lessons[item.id]);
  const related = LIBRARY.filter((c) => c.topic === item.topic && c.id !== item.id)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);

  return (
    <article className="stagger space-y-5">
      <div className="flex items-center justify-between">
        <Link href={back.href} className="flex items-center gap-1 text-sm text-ink-soft">
          <ArrowLeft size={16} /> {back.label}
        </Link>
        <BookmarkButton contentId={item.id} />
      </div>

      <div className="overflow-hidden rounded-[28px]">
        {item.kind === "video" ? (
          <div className="relative">
            <Cover item={item} className="aspect-video w-full" showPlay={false} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30 text-white">
              <PlayCircle size={44} />
              <p className="text-sm font-semibold">Video coming soon</p>
              <p className="text-xs text-white/80">Key points are below</p>
            </div>
          </div>
        ) : (
          <Cover item={item} className="aspect-[16/9] w-full" />
        )}
      </div>

      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-forest">
          <Link href={`/social/topic/${item.topic}`} className="underline-offset-2 hover:underline">
            {topic?.title}
          </Link>{" "}
          · {KIND_LABEL[item.kind]} · {item.minutes} min
        </p>
        <h1 className="mt-2 text-[26px] font-bold leading-tight">{title}</h1>
        {!sw && <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{item.summary}</p>}
        <p className="mt-3 flex items-start gap-1.5 rounded-2xl bg-bg px-3 py-2 text-[11px] leading-snug text-ink-soft ring-1 ring-line">
          <ShieldCheck size={13} className="mt-px shrink-0 text-forest" />
          <span>
            {item.source}
            {item.fixture && " · Sample content for development"}
          </span>
        </p>
        {(item.bodySw || item.origin) && (
          <div className="mt-3 flex items-center justify-between gap-2">
            {item.bodySw ? (
              <div className="inline-flex rounded-full bg-surface p-1 text-xs font-semibold ring-1 ring-line" role="tablist" aria-label="Language">
                {(["en", "sw"] as const).map((l) => (
                  <button
                    key={l}
                    role="tab"
                    aria-selected={lang === l}
                    onClick={() => setLang(l)}
                    className={`rounded-full px-3 py-1.5 ${lang === l ? "bg-forest text-white" : "text-ink-soft"}`}
                  >
                    {l === "en" ? "English" : "Kiswahili"}
                  </button>
                ))}
              </div>
            ) : (
              <span />
            )}
            {item.origin && (
              <a
                href={item.origin.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-semibold text-forest"
              >
                {item.origin.format === "reel" ? "Watch on Instagram" : "View on Instagram"} <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}
      </header>

      {item.kind === "expert" && item.question && (
        <blockquote className="flex gap-3 rounded-3xl bg-mint/60 p-4">
          <MessageCircle size={18} className="mt-0.5 shrink-0 text-forest" />
          <p className="text-sm font-medium italic text-forest-deep">&ldquo;{item.question}&rdquo;</p>
        </blockquote>
      )}

      {body && (
        <div lang={sw ? "sw" : "en"} className="space-y-3 rounded-3xl bg-surface p-5 text-[15px] leading-relaxed ring-1 ring-line">
          {body.map((p, i) =>
            p.startsWith("## ") ? (
              <h2 key={i} className="pt-2 text-lg font-bold">
                {p.slice(3)}
              </h2>
            ) : (
              <p key={i}>{p}</p>
            ),
          )}
        </div>
      )}

      {item.keyPoints && (
        <div className="rounded-3xl bg-surface p-5 ring-1 ring-line">
          <h2 className="font-bold">Key points</h2>
          <ol className="mt-3 space-y-2">
            {item.keyPoints.map((k, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint text-xs font-bold text-forest">
                  {i + 1}
                </span>
                {k}
              </li>
            ))}
          </ol>
        </div>
      )}

      {item.quiz && <QuizRunner questions={item.quiz} />}
      {item.tool === "pelvic-floor" && <PelvicFloorTrainer />}
      {item.tool === "doctor-check" && <DoctorCheck />}

      {item.inManFeed && feed.ready && (
        <button
          onClick={() => {
            if (read) return;
            feedStore.markLessonRead(item.id);
            showToast(`Lesson read · +${item.points ?? 10} points`);
          }}
          className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-transform active:scale-[0.98] ${
            read ? "bg-mint text-forest" : "bg-forest text-white"
          }`}
        >
          {read ? (
            <>
              <Check size={16} /> You&apos;ve read this
            </>
          ) : (
            `Mark as read · +${item.points ?? 10} points`
          )}
        </button>
      )}

      <p className="px-2 text-center text-[11px] text-ink-soft">General education, not medical advice.</p>

      {related.length > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="text-base font-bold">More on {topic?.title.toLowerCase()}</h2>
          {related.map((r) => (
            <ContentRow key={r.id} item={r} />
          ))}
        </section>
      )}
    </article>
  );
}
