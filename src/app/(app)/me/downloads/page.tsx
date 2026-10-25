"use client";

// My downloads (Step 67): guides and lessons kept on this phone for use with no internet, how much space
// they take, and the course lessons he can still download. Works offline itself once opened online.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, CloudDownload, Headphones, Trash2, Wifi, WifiOff } from "lucide-react";
import { LessonDownloadButton } from "@/components/offline/SaveButtons";
import { courseView } from "@/lib/course/progress";
import { pick, useMainCourse } from "@/lib/course/useCourses";
import { useFeed } from "@/lib/feed/store";
import { downloads, sizeLabel, useDownloads, type Download } from "@/lib/offline/downloads";
import { useOnline } from "@/lib/offline/online";
import { useT } from "@/lib/i18n";

export default function DownloadsPage() {
  const t = useT();
  const sw = t.lang === "sw";
  const online = useOnline();
  const state = useDownloads();
  const { course } = useMainCourse();
  const feed = useFeed();
  const [space, setSpace] = useState<{ used: number; quota: number } | null>(null);

  const list = Object.values(state.items).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  const guides = list.filter((d) => d.kind === "guide");
  const lessons = list.filter((d) => d.kind === "lesson");
  const total = list.reduce((s, d) => s + (d.status === "ready" ? d.bytes : 0), 0);

  useEffect(() => {
    void navigator.storage
      ?.estimate?.()
      .then((e) => setSpace({ used: e.usage ?? 0, quota: e.quota ?? 0 }))
      .catch(() => {});
  }, [total]);

  // Lessons he can open now (not locked) that have a file and aren't on the phone yet
  const more = useMemo(() => {
    if (!course || !feed.ready) return [];
    return courseView(course, feed.course).lessons.filter((l) => l.kind !== "reading" && l.mediaUrl && l.state !== "locked" && l.state !== "soon" && !state.items[l.id]);
  }, [course, feed.ready, feed.course, state.items]);

  return (
    <div className="stagger space-y-5">
      <Link href="/me" className="tap-target flex items-center gap-1 text-sm text-ink-soft">
        <ArrowLeft size={16} /> {t("Me")}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{t("My downloads")}</h1>
        <p className="mt-1 text-sm text-ink-soft">{t("Guides and lessons on this phone. They work with no internet.")}</p>
      </div>

      <div className="flex items-center gap-3 rounded-3xl bg-surface p-4 ring-1 ring-line">
        {online ? <Wifi size={18} className="shrink-0 text-forest" /> : <WifiOff size={18} className="shrink-0 text-forest" />}
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">{t(online ? "Online" : "Offline")}</p>
          <p className="text-xs text-ink-soft">
            {t("{n} saved · {size} on this phone", { n: list.length, size: sizeLabel(total) })}
            {space && space.quota ? ` · ${t("{size} free", { size: sizeLabel(Math.max(0, space.quota - space.used)) })}` : ""}
          </p>
        </div>
      </div>

      {list.length === 0 && (
        <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
          <CloudDownload className="mx-auto text-forest" size={26} />
          <p className="mt-2 font-semibold">{t("Nothing downloaded yet")}</p>
          <p className="mt-1 text-sm text-ink-soft">{t("Tap “Save offline” on a guide, or “Download” on a lesson, to keep it here.")}</p>
        </div>
      )}

      {guides.length > 0 && (
        <Group title={t("Guides")}>
          {guides.map((d) => (
            <Row key={d.id} d={d} sw={sw} icon={<BookOpen size={16} className="shrink-0 text-forest" />} />
          ))}
        </Group>
      )}

      {lessons.length > 0 && (
        <Group title={t("Lessons")}>
          {lessons.map((d) => (
            <Row key={d.id} d={d} sw={sw} icon={<Headphones size={16} className="shrink-0 text-forest" />} />
          ))}
        </Group>
      )}

      {more.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-sm font-bold">{t("Course lessons you can download")}</h2>
          <div className="space-y-2">
            {more.map((l) => (
              <div key={l.id}>
                <p className="mb-1 px-1 text-xs font-semibold text-ink-soft">
                  {l.code} · {pick(sw, l.title, l.titleSw)}
                </p>
                <LessonDownloadButton lesson={l} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-bold">{title}</h2>
      <ul className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">{children}</ul>
    </section>
  );
}

function Row({ d, sw, icon }: { d: Download; sw: boolean; icon: React.ReactNode }) {
  const t = useT();
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      {icon}
      <Link href={d.href} className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{sw && d.titleSw ? d.titleSw : d.title}</span>
        <span className="block text-xs text-ink-soft">
          {d.status === "ready" ? sizeLabel(d.bytes) : t("Cleared by the phone. Open it and download again.")}
        </span>
      </Link>
      <button type="button" onClick={() => void downloads.remove(d.id)} aria-label={t("Remove from this phone")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft ring-1 ring-line">
        <Trash2 size={15} />
      </button>
    </li>
  );
}
