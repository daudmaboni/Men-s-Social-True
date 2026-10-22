"use client";

import { useState } from "react";
import { MessageCircle, PlayCircle, ShieldCheck } from "lucide-react";
import Cover from "@/components/social/Cover";
import { TOPICS } from "@/lib/content/library";
import { CTA_LABEL, KIND_LABEL } from "@/lib/content/select";
import type { ContentItem } from "@/lib/content/types";

/** How the item will look on a man's phone: the Discover card, then the opened page. */
export default function Preview({ item }: { item: ContentItem }) {
  const [lang, setLang] = useState<"en" | "sw">("en");
  const sw = lang === "sw";
  const title = (sw && item.titleSw) || item.title || "Your title";
  const body = sw ? item.bodySw : item.body;
  const topic = TOPICS.find((t) => t.id === item.topic)?.title;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
          Phone preview
        </p>
        <div className="inline-flex rounded-full bg-surface p-0.5 text-[0.6875rem] font-semibold ring-1 ring-line">
          {(["en", "sw"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`rounded-full px-2.5 py-1 ${lang === l ? "bg-forest text-white" : "text-ink-soft"}`}
            >
              {l === "en" ? "EN" : "SW"}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[36px] border-[6px] border-ink bg-bg shadow-xl">
        <div className="max-h-[640px] space-y-4 overflow-y-auto p-4 [scrollbar-width:thin]">
          {item.kind === "reel" ? (
            /* A reel as it plays full screen on Discover */
            <div className="relative -m-4 aspect-[9/16] overflow-hidden bg-forest-deep">
              {item.videoUrl ? (
                <video src={item.videoUrl} poster={item.coverImageUrl} muted loop playsInline autoPlay className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-white/70">Upload the video to see it here</div>
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
              <div className="absolute inset-x-4 bottom-5 pr-12 text-white">
                <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-mint">Reel</p>
                <p className="mt-1 font-bold leading-snug">{title}</p>
                <p className="mt-1 line-clamp-3 text-xs text-white/85">{(sw && item.summarySw) || item.summary || "Your caption appears here."}</p>
              </div>
            </div>
          ) : (
            /* How it shows in search, Saved, topic pages and Kito's links */
            <div className="flex gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line">
              <Cover item={item} className="h-16 w-16 shrink-0 rounded-xl" showPlay={false} />
              <div className="min-w-0">
                <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-forest">
                  {KIND_LABEL[item.kind]} · {item.minutes} min
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm font-bold leading-snug">{title}</p>
                <p className="mt-0.5 text-[0.625rem] text-ink-soft">In search, Saved, topic pages and Kito · {CTA_LABEL[item.kind]} →</p>
              </div>
            </div>
          )}

          <p className="text-center text-[0.625rem] uppercase tracking-wider text-ink-soft">
            Opened page
          </p>

          {item.kind === "video" && (
            <div className="relative overflow-hidden rounded-3xl">
              <Cover
                item={item}
                className="aspect-video w-full"
                showPlay={false}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                <PlayCircle size={36} />
              </div>
            </div>
          )}
          <div>
            <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-forest">
              {topic} · {KIND_LABEL[item.kind]}
            </p>
            <h2 className="mt-1 text-xl font-bold leading-tight">{title}</h2>
            {!sw && item.summary && (
              <p className="mt-1 text-sm text-ink-soft">{item.summary}</p>
            )}
            <p className="mt-2 flex items-start gap-1 rounded-xl bg-surface px-2 py-1.5 text-[0.625rem] text-ink-soft ring-1 ring-line">
              <ShieldCheck size={11} className="mt-px shrink-0 text-forest" />
              {item.source}
              {item.review === "reviewed" ? " · Reviewed" : ""}
            </p>
          </div>

          {item.kind === "expert" && item.question && (
            <blockquote className="flex gap-2 rounded-2xl bg-mint/60 p-3 text-xs italic text-forest-deep">
              <MessageCircle
                size={14}
                className="mt-0.5 shrink-0 text-forest"
              />
              “{item.question}”
            </blockquote>
          )}

          {sw && !item.bodySw?.length ? (
            <p className="rounded-2xl bg-amber-50 p-3 text-xs text-amber-800">
              No Kiswahili text yet. Readers will only see English.
            </p>
          ) : (
            body &&
            body.length > 0 && (
              <div className="space-y-2 rounded-2xl bg-surface p-4 text-sm leading-relaxed ring-1 ring-line">
                {body.map((p, i) =>
                  p.startsWith("## ") ? (
                    <h3 key={i} className="pt-1 font-bold">
                      {p.slice(3)}
                    </h3>
                  ) : (
                    <p key={i}>{p}</p>
                  ),
                )}
              </div>
            )
          )}

          {item.keyPoints && item.keyPoints.length > 0 && (
            <ol className="space-y-1.5 rounded-2xl bg-surface p-4 text-xs ring-1 ring-line">
              {item.keyPoints.map((k, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-bold text-forest">{i + 1}.</span>
                  {k}
                </li>
              ))}
            </ol>
          )}

          {item.quiz && item.quiz.length > 0 && (
            <div className="rounded-2xl bg-surface p-4 text-xs ring-1 ring-line">
              <p className="font-bold">Quiz · {item.quiz.length} questions</p>
              <p className="mt-1 text-ink-soft">
                {item.quiz[0].q || "First question"}
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
