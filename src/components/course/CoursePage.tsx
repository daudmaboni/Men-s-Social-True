"use client";

// The whole course (Step 48): progress at the top, then each module with its lessons.
// Finished lessons stay open, the current one is highlighted, the rest open one after another.

import Link from "next/link";
import { ArrowLeft, BookOpen, Check, Clock3, Headphones, Lock, Play, ShieldCheck, Video } from "lucide-react";
import CourseArt from "./CourseArt";
import { useToast } from "@/components/motion/Toast";
import { useFeed } from "@/lib/feed/store";
import { pick, useMainCourse } from "@/lib/course/useCourses";
import { canOpen, clock, courseView, type CourseView } from "@/lib/course/progress";
import { lessonMinutes } from "@/lib/course/types";
import { useT } from "@/lib/i18n";

export default function CoursePage() {
  const { course, ready } = useMainCourse();
  const feed = useFeed();
  const t = useT();
  const showToast = useToast();
  const sw = t.lang === "sw";

  if (!course) {
    return (
      <div className="space-y-4">
        <Link href="/man" className="tap-target flex items-center gap-1 text-sm text-ink-soft">
          <ArrowLeft size={16} /> {t("Man")}
        </Link>
        {ready ? (
          <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
            <p className="font-semibold">{t("The course is coming soon")}</p>
            <p className="mt-1 text-sm text-ink-soft">{t("We'll let you know when it opens.")}</p>
          </div>
        ) : (
          <div className="h-56 animate-pulse rounded-[28px] bg-forest-deep/15" />
        )}
      </div>
    );
  }

  const v = courseView(course, feed.course);
  const next = v.current;
  const started = v.done > 0;

  return (
    <div className="stagger space-y-5">
      <Link href="/man" className="tap-target flex items-center gap-1 text-sm text-ink-soft">
        <ArrowLeft size={16} /> {t("Man")}
      </Link>

      <section className="relative overflow-hidden rounded-[28px] bg-forest-deep p-5 text-white">
        <CourseArt className="absolute inset-y-0 right-0 w-1/2 opacity-60 [mask-image:linear-gradient(to_left,black,transparent)]" icon={false} />
        <div className="relative">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-mint-strong">
            <Headphones size={14} /> {t("Audio course")} · {t("Free")}
          </p>
          <h1 className="mt-2 text-[1.625rem] font-bold leading-tight">{pick(sw, course.title, course.titleSw)}</h1>
          <p className="mt-2 text-sm leading-relaxed text-mint">{pick(sw, course.summary, course.summarySw)}</p>
          <div className="mt-4 flex items-end justify-between gap-3">
            <p className="text-xs text-mint">
              <span className="text-3xl font-bold text-white">{v.percent}%</span> {t("done")}
            </p>
            <p className="text-xs text-mint">{t("{done} of {total} lessons", { done: v.done, total: v.total })}</p>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label={t("Course progress")} aria-valuenow={v.percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-mint-strong transition-[width] duration-700 ease-out" style={{ width: `${v.done ? Math.max(v.percent, 4) : 0}%` }} />
          </div>
          {next ? (
            <Link
              href={`/man/course/${next.id}${next.kind === "reading" ? "" : "?play=1"}`}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-mint-strong py-3.5 text-sm font-bold text-forest-deep transition-transform active:scale-[0.98]"
            >
              <Play size={16} fill="currentColor" />
              {started ? t("Continue · Lesson {n}", { n: next.number }) : t("Start lesson 1")}
            </Link>
          ) : v.finished ? (
            <p className="mt-5 flex items-center justify-center gap-2 rounded-full bg-white/10 py-3.5 text-sm font-semibold">
              <Check size={16} /> {t("Course complete. Well done!")}
            </p>
          ) : null}
        </div>
      </section>

      <p className="flex items-start gap-1.5 rounded-2xl bg-bg px-3 py-2 text-[0.6875rem] leading-snug text-ink-soft ring-1 ring-line">
        <ShieldCheck size={13} className="mt-px shrink-0 text-forest" />
        <span>
          {pick(sw, course.credit, course.creditSw)} · {t("Lessons open one after another. Listen to {n}% of a lesson to open the next.", { n: course.passPercent })}
        </span>
      </p>

      {course.modules.map((m, mi) => (
        <Module
          key={m.id}
          index={mi}
          title={pick(sw, m.title, m.titleSw)}
          stats={v.modules[mi]}
          lessons={v.lessons.filter((l) => l.moduleIndex === mi)}
          onLocked={() => showToast(t("Finish the lesson before it to open this one"))}
        />
      ))}

    </div>
  );
}

function Module({
  index,
  title,
  stats,
  lessons,
  onLocked,
}: {
  index: number;
  title: string;
  stats: { done: number; total: number };
  lessons: CourseView["lessons"];
  onLocked: () => void;
}) {
  const t = useT();
  const sw = t.lang === "sw";
  const complete = stats.total > 0 && stats.done === stats.total;
  return (
    <section className="rounded-3xl bg-surface p-2 ring-1 ring-line">
      <header className="flex items-center gap-3 px-3 pb-2 pt-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${complete ? "bg-forest text-white" : "bg-mint text-forest"}`}
        >
          {complete ? <Check size={16} /> : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-medium text-ink-soft">{t("Module {n}", { n: index + 1 })}</p>
          <h2 className="truncate font-bold leading-tight">{title}</h2>
        </div>
        <span className="text-xs font-semibold tabular-nums text-ink-soft">
          {stats.done}/{stats.total}
        </span>
      </header>
      <ul>
        {lessons.map((l) => {
          const open = canOpen(l.state);
          const Icon = l.kind === "video" ? Video : l.kind === "reading" ? BookOpen : Headphones;
          const resume = l.state === "current" && l.kind !== "reading" && l.progress?.pos ? l.progress.pos : 0;
          const inner = (
            <>
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  l.state === "done"
                    ? "bg-mint text-forest"
                    : l.state === "current"
                      ? "bg-forest text-white"
                      : "bg-bg text-ink-soft ring-1 ring-line"
                }`}
              >
                {l.state === "done" ? (
                  <Check size={16} />
                ) : l.state === "current" ? (
                  <Play size={14} fill="currentColor" className="translate-x-px" />
                ) : l.state === "soon" ? (
                  <Clock3 size={15} />
                ) : (
                  <Lock size={14} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold leading-snug ${open ? "" : "text-ink-soft"}`}>
                  {l.number}. {pick(sw, l.title, l.titleSw)}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-[0.6875rem] text-ink-soft">
                  <Icon size={12} />
                  {l.state === "soon"
                    ? t("Coming soon")
                    : resume
                      ? t("Continue from {time}", { time: clock(resume) })
                      : t("{n} min", { n: lessonMinutes(l) })}
                  {l.state === "done" && ` · ${t("Done")}`}
                </span>
              </span>
            </>
          );
          const cls = `flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${l.state === "current" ? "bg-mint/50" : ""}`;
          return (
            <li key={l.id}>
              {open ? (
                <Link href={`/man/course/${l.id}`} className={`${cls} active:bg-mint/60`}>
                  {inner}
                </Link>
              ) : (
                <button type="button" onClick={l.state === "locked" ? onLocked : undefined} className={cls} aria-disabled="true">
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
