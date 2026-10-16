"use client";

// "Your course": the first card on the Man tab (Step 48).
// Shows where he is in the course and one big button to continue exactly where he stopped.

import Link from "next/link";
import { BookOpen, Check, ChevronRight, Play, Video } from "lucide-react";
import CourseArt from "./CourseArt";
import { useFeed } from "@/lib/feed/store";
import { useMainCourse, pick } from "@/lib/course/useCourses";
import { clock, courseView } from "@/lib/course/progress";
import { lessonMinutes } from "@/lib/course/types";
import { useT } from "@/lib/i18n";

export default function CourseCard() {
  const { course } = useMainCourse();
  const feed = useFeed();
  const t = useT();
  if (!course || !feed.ready) return null;
  const sw = t.lang === "sw";
  const v = courseView(course, feed.course);
  if (v.total === 0) return null;
  const next = v.current;
  const discreet = feed.settings.discreet;
  const title = discreet ? t("Your course") : pick(sw, course.title, course.titleSw);
  const mod = next ? course.modules[next.moduleIndex] : null;
  const started = v.done > 0 || Object.keys(feed.course ?? {}).length > 0;
  const resumeAt = next?.progress?.pos && next.kind !== "reading" ? next.progress.pos : 0;
  const KindIcon = next?.kind === "video" ? Video : next?.kind === "reading" ? BookOpen : Play;

  return (
    <section className="overflow-hidden rounded-3xl bg-surface ring-1 ring-line lg:flex lg:items-stretch">
      <Link href="/man/course" className="flex items-center gap-4 p-5 pb-4 lg:flex-1 lg:pb-5" aria-label={t("Open the course")}>
        <CourseArt className="h-16 w-16 shrink-0 rounded-2xl lg:h-20 lg:w-20" size={26} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-forest">
            {t("Your course")} · {t("Free")}
          </p>
          <p className="mt-0.5 truncate text-lg font-bold leading-tight">{title}</p>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-mint"
            role="progressbar"
            aria-label={t("Course progress")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={v.percent}
          >
            <div className="h-full rounded-full bg-forest transition-[width] duration-700 ease-out" style={{ width: `${v.done ? Math.max(v.percent, 4) : 0}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-ink-soft">
            {t("{done} of {total} lessons", { done: v.done, total: v.total })} · {v.percent}%
          </p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-ink-soft lg:hidden" />
      </Link>

      {next ? (
        <Link
          href={`/man/course/${next.id}${next.kind === "reading" ? "" : "?play=1"}`}
          className="flex items-center gap-3 border-t border-line bg-mint/50 px-5 py-3.5 transition-colors active:bg-mint lg:w-[420px] lg:border-l lg:border-t-0 lg:py-5"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest text-white shadow-sm">
            <KindIcon size={18} className={next.kind === "audio" ? "translate-x-px" : ""} fill={next.kind === "audio" ? "currentColor" : "none"} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold text-forest">
              {started ? t("Continue") : t("Start the course")} · {t("Lesson {n}", { n: next.number })}
              {mod && !discreet ? ` · ${pick(sw, mod.title, mod.titleSw)}` : ""}
            </span>
            <span className="block truncate text-sm font-semibold">{discreet ? t("Lesson {n}", { n: next.number }) : pick(sw, next.title, next.titleSw)}</span>
            <span className="block text-[11px] text-ink-soft">
              {resumeAt ? t("From {time}", { time: clock(resumeAt) }) : t("{n} min", { n: lessonMinutes(next) })}
            </span>
          </span>
        </Link>
      ) : (
        <Link href="/man/course" className="flex items-center gap-3 border-t border-line bg-mint/50 px-5 py-3.5 lg:w-[420px] lg:border-l lg:border-t-0">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest text-white">
            <Check size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t("Course complete")}</span>
            <span className="block text-[11px] text-ink-soft">{t("Listen to any lesson again, any time.")}</span>
          </span>
        </Link>
      )}
    </section>
  );
}
