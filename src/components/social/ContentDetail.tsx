"use client";

import { sized } from "@/lib/media/image";
import Photo from "@/components/media/Photo";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, MessageCircle, PlayCircle, ShieldCheck } from "lucide-react";
import Cover from "./Cover";
import BookmarkButton from "./BookmarkButton";
import { SaveGuideButton } from "@/components/offline/SaveButtons";
import { useDownloads } from "@/lib/offline/downloads";
import { ContentRow } from "./ContentCards";
import { DoctorCheck, PelvicFloorTrainer, QuizRunner } from "./ContentTools";
import { useToast } from "@/components/motion/Toast";
import { useLibrary } from "@/lib/content/useLibrary";
import { useLang, type Lang } from "@/lib/me/lang";
import { getContent } from "@/lib/content/select";
import { feedStore, useFeed } from "@/lib/feed/store";
import { socialStore } from "@/lib/social/store";
import { useT } from "@/lib/i18n";
import { metaOf, topicTitle } from "@/lib/content/display";
import { trackContent } from "@/lib/analytics/track";
import { isYouTubeShort, youtubeId } from "@/lib/content/youtube";
import { YouTubeFrame } from "@/components/media/YouTubeFrame";
import { useAccount } from "@/lib/account/useAccount";
import GuestGuideCard from "@/components/account/GuestGuideCard";

/** Full page for any piece of content: guide, article, video, quiz, tool or expert answer. */
export default function ContentDetail({ id, back }: { id: string; back: { href: string; label: string } }) {
  const library = useLibrary();
  // A guide saved for offline still opens when it's no longer in the content list on this phone (Step 67)
  const saved = useDownloads().items[id];
  const item = getContent(id, library.items) ?? (saved?.kind === "guide" ? (saved.item ?? null) : null);
  const feed = useFeed();
  const acc = useAccount();
  const showToast = useToast();
  const t = useT();
  // Opens in the language he chose (Me tab); he can still switch on the page
  const appLang = useLang();
  const [picked, setLang] = useState<Lang | null>(null);
  const lang = picked ?? appLang;
  // Reading completion: he scrolled to the end of a guide, article or answer
  const endRef = useRef<HTMLParagraphElement>(null);
  const readable = item ? ["guide", "article", "expert", "infographic"].includes(item.kind) : false;
  useEffect(() => {
    const el = endRef.current;
    if (!el || !readable || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        trackContent(id, "complete");
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [id, readable]);
  // Remember he opened it, so Discover can suggest things he hasn't read yet
  const found = Boolean(item);
  useEffect(() => {
    if (!found) return;
    socialStore.recordOpen(id);
    trackContent(id, "view");
  }, [found, id]);

  if (!item && !library.ready) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label={t("Loading")}>
        <div className="aspect-[16/9] animate-pulse rounded-[28px] bg-forest-deep/15" />
        <div className="h-7 w-3/4 animate-pulse rounded-full bg-line" />
        <div className="h-40 animate-pulse rounded-3xl bg-surface ring-1 ring-line" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-4">
        <Link href={back.href} className="flex items-center gap-1 text-sm text-ink-soft">
          <ArrowLeft size={16} /> {t(back.label)}
        </Link>
        <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
          <p className="font-semibold">{t("This content isn't available")}</p>
          <p className="mt-1 text-sm text-ink-soft">{t("It may have been moved or removed.")}</p>
          <Link href="/social" className="mt-4 inline-block rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white">
            {t("Go to Discover")}
          </Link>
        </div>
      </div>
    );
  }

  const sw = lang === "sw" && Boolean(item.bodySw);
  const title = lang === "sw" && item.titleSw ? item.titleSw : item.title;
  const yt = youtubeId(item.videoUrl);
  const upright = item.kind === "reel" || isYouTubeShort(item.videoUrl);
  const body = sw ? item.bodySw : item.body;
  const read = Boolean(feed.lessons[item.id]);
  const related = library.items.filter((c) => c.topic === item.topic && c.id !== item.id)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);

  return (
    <article className="stagger space-y-5">
      <div className="flex items-center justify-between">
        <Link href={back.href} className="flex items-center gap-1 text-sm text-ink-soft">
          <ArrowLeft size={16} /> {t(back.label)}
        </Link>
        <div className="flex items-center gap-2">
          <SaveGuideButton item={item} href={`/social/c/${item.id}`} />
          <BookmarkButton contentId={item.id} />
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px]">
        {yt && (item.kind === "reel" || item.kind === "video" || item.action) ? (
          // A YouTube video (Step 74): plays right here, with YouTube's own buttons
          <YouTubeFrame
            id={yt}
            controls
            title={title}
            onEnded={() => trackContent(item.id, "complete")}
            className={upright ? "mx-auto aspect-[9/16] max-h-[78dvh] w-full" : "aspect-video w-full"}
          />
        ) : item.kind === "reel" && item.videoUrl ? (
          // A reel (Step 70): upright video, as tall as the screen allows
          <video
            src={item.videoUrl}
            poster={item.coverImageUrl ? sized(item.coverImageUrl, 720) : undefined}
            controls
            playsInline
            preload="metadata"
            onEnded={() => trackContent(item.id, "complete")}
            className="mx-auto aspect-[9/16] max-h-[78dvh] w-full bg-black object-contain"
          />
        ) : item.kind === "video" && item.videoUrl ? (
          <video
            src={item.videoUrl}
            poster={item.coverImageUrl ? sized(item.coverImageUrl, 720) : undefined}
            controls
            playsInline
            preload="metadata"
            onEnded={() => trackContent(item.id, "complete")}
            className="aspect-video w-full bg-black"
          />
        ) : item.kind === "infographic" && item.coverImageUrl ? (
          <Photo src={item.coverImageUrl} alt={title} eager className="w-full bg-surface" />
        ) : item.kind === "audio" ? (
          <div className="space-y-3 bg-forest-deep p-4">
            <Cover item={item} className="aspect-[2/1] w-full rounded-2xl" showPlay={false} />
            {item.audioUrl ? (
              <audio src={item.audioUrl} controls preload="metadata" onEnded={() => trackContent(item.id, "complete")} className="w-full" />
            ) : (
              <p className="text-center text-sm text-mint">{t("Audio coming soon")}</p>
            )}
          </div>
        ) : item.action && item.videoUrl ? (
          <video src={item.videoUrl} poster={item.coverImageUrl ? sized(item.coverImageUrl, 720) : undefined} controls playsInline preload="metadata" className="aspect-video w-full bg-black" />
        ) : item.action && item.audioUrl ? (
          <div className="space-y-3 bg-forest-deep p-4">
            <Cover item={item} className="aspect-[2/1] w-full rounded-2xl" showPlay={false} />
            <audio src={item.audioUrl} controls preload="metadata" className="w-full" />
          </div>
        ) : item.kind === "video" ? (
          <div className="relative">
            <Cover item={item} className="aspect-video w-full" showPlay={false} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30 text-white">
              <PlayCircle size={44} />
              <p className="text-sm font-semibold">{t("Video coming soon")}</p>
              <p className="text-xs text-white/80">{t("Key points are below")}</p>
            </div>
          </div>
        ) : (
          <Cover item={item} className="aspect-[16/9] w-full" />
        )}
      </div>

      <header>
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-forest">
          <Link href={`/social/topic/${item.topic}`} className="underline-offset-2 hover:underline">
            {topicTitle(item.topic, t)}
          </Link>{" "}
          · {metaOf(item, t)}
        </p>
        <h1 className="mt-2 text-[1.625rem] font-bold leading-tight">{title}</h1>
        {(lang !== "sw" || item.summarySw) && <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{lang === "sw" && item.summarySw ? item.summarySw : item.summary}</p>}
        <p className="mt-3 flex items-start gap-1.5 rounded-2xl bg-bg px-3 py-2 text-[0.6875rem] leading-snug text-ink-soft ring-1 ring-line">
          <ShieldCheck size={13} className="mt-px shrink-0 text-forest" />
          <span>
            {item.source}
            {item.fixture && ` · ${t("Sample content for development")}`}
          </span>
        </p>
        {(item.bodySw || item.origin) && (
          <div className="mt-3 flex items-center justify-between gap-2">
            {item.bodySw ? (
              <div className="inline-flex rounded-full bg-surface p-1 text-xs font-semibold ring-1 ring-line" role="tablist" aria-label={t("Language")}>
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
                {t(item.origin.format === "reel" ? "Watch on Instagram" : "View on Instagram")} <ExternalLink size={12} />
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
        <div lang={sw ? "sw" : "en"} className="space-y-3 rounded-3xl bg-surface p-5 text-[0.9375rem] leading-relaxed ring-1 ring-line">
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
          <h2 className="font-bold">{t("Key points")}</h2>
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

      {item.quiz && <QuizRunner questions={item.quiz} onFinish={() => trackContent(item.id, "complete")} />}
      {item.tool === "pelvic-floor" && <PelvicFloorTrainer />}
      {item.tool === "doctor-check" && <DoctorCheck />}

      {/* Points need an account (the Man tab is for members); guests get the invite card instead */}
      {item.inManFeed && feed.ready && acc.status !== "guest" && (
        <button
          onClick={() => {
            if (read) return;
            feedStore.markLessonRead(item.id);
            trackContent(item.id, "complete");
            showToast(t("Lesson read · +{n} points", { n: item.points ?? 10 }));
          }}
          className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-transform active:scale-[0.98] ${
            read ? "bg-mint text-forest" : "bg-forest text-white"
          }`}
        >
          {read ? (
            <>
              <Check size={16} /> {t("You've read this")}
            </>
          ) : (
            t("Mark as read · +{n} points", { n: item.points ?? 10 })
          )}
        </button>
      )}

      {/* Marks the end of the page, for "he read it all" */}
      <p ref={endRef} aria-hidden className="h-px" />

      <GuestGuideCard next={`/social/c/${item.id}`} />

      {related.length > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="text-base font-bold">{t("More on {topic}", { topic: topicTitle(item.topic, t).toLowerCase() })}</h2>
          {related.map((r) => (
            <ContentRow key={r.id} item={r} />
          ))}
        </section>
      )}
    </article>
  );
}
