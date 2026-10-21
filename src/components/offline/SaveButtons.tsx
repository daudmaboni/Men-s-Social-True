"use client";

// "Save offline" for a guide and "Download" for a lesson (Step 67). See lib/offline/downloads.ts.

import { useState } from "react";
import { Check, CloudDownload, Download, Loader2 } from "lucide-react";
import type { ContentItem } from "@/lib/content/types";
import { downloads, sizeLabel, useDownloads } from "@/lib/offline/downloads";
import { useOnline } from "@/lib/offline/online";
import { useToast } from "@/components/motion/Toast";
import { useT } from "@/lib/i18n";

export function SaveGuideButton({ item, href }: { item: ContentItem; href: string }) {
  const t = useT();
  const showToast = useToast();
  const d = useDownloads().items[item.id];
  const saved = d?.status === "ready";
  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => {
        if (saved) {
          void downloads.remove(item.id);
          showToast(t("Removed from this phone"));
        } else {
          void downloads.saveGuide(item, href);
          showToast(t("Saved. You can read it with no internet."));
        }
      }}
      className={`flex h-10 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold ring-1 transition-colors ${saved ? "bg-mint text-forest-deep ring-mint-strong/40" : "bg-surface text-ink ring-line"}`}
    >
      {saved ? <Check size={15} /> : <CloudDownload size={15} />}
      {t(saved ? "On this phone" : "Save offline")}
    </button>
  );
}

export function LessonDownloadButton({ lesson }: { lesson: { id: string; title: string; titleSw?: string; mediaUrl?: string } }) {
  const t = useT();
  const showToast = useToast();
  const online = useOnline();
  const state = useDownloads();
  const d = state.items[lesson.id];
  const progress = state.progress[lesson.id];
  const [busy, setBusy] = useState(false);
  if (!lesson.mediaUrl) return null;
  const ready = d?.status === "ready";
  const loading = busy || progress !== undefined;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{t(ready ? "On this phone" : "Listen with no internet")}</p>
        <p className="text-xs text-ink-soft">
          {ready
            ? t("Plays from your phone ({size}).", { size: sizeLabel(d.bytes) })
            : d?.status === "failed"
              ? t("The saved copy was cleared. Download it again.")
              : t("Download this lesson to play it anywhere.")}
        </p>
      </div>
      {ready ? (
        <button
          type="button"
          onClick={() => {
            void downloads.remove(lesson.id);
            showToast(t("Removed from this phone"));
          }}
          className="shrink-0 rounded-full px-3.5 py-2 text-xs font-bold text-ink-soft ring-1 ring-line"
        >
          {t("Remove")}
        </button>
      ) : (
        <button
          type="button"
          disabled={loading || !online}
          onClick={async () => {
            setBusy(true);
            try {
              await downloads.saveLesson({ id: lesson.id, title: lesson.title, titleSw: lesson.titleSw, href: `/man/course/${lesson.id}`, mediaRef: lesson.mediaUrl! });
              showToast(t("Downloaded. It plays with no internet."));
            } catch {
              showToast(t("Couldn't download. Check your internet and space on the phone."));
            } finally {
              setBusy(false);
            }
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-forest px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {loading ? (progress ? `${progress}%` : t("Starting…")) : t("Download")}
        </button>
      )}
    </div>
  );
}
