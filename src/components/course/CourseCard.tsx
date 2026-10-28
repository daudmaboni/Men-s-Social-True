"use client";

// "Your course": the first card on the Man tab (Step 48).
// Shows where he is in the course and one big button to continue exactly where he stopped.

import { useEffect, useRef } from "react";
import Link from "next/link";
import { BookOpen, Check, ChevronRight, ListChecks, Lock, Pause, Play, Video } from "lucide-react";
import CourseArt from "./CourseArt";
import Countdown from "./Countdown";
import { toPlayerLesson } from "./CoursePlayerHost";
import SwipeRow from "@/components/motion/SwipeRow";
import { coursePlayer, setCourseCardOnScreen, useCoursePlayer, useCoursePlayerSelect, type PlayerState } from "@/lib/course/player";
import { useFeed } from "@/lib/feed/store";
import { useMainCourse, pick } from "@/lib/course/useCourses";
import { clock, courseView, type CourseView } from "@/lib/course/progress";
import { lessonAfter, lessonMinutes, type Course } from "@/lib/course/types";
import { useT } from "@/lib/i18n";

export default function CourseCard() {
  const { course } = useMainCourse();
  const feed = useFeed();
  // Only which lesson is playing (not every second of it), so the card doesn't redraw while scrolling
  const playingId = useCoursePlayerSelect((s) => s.lesson?.id ?? null);
  const t = useT();
  // Tell the mini player whether this card is on screen (it hides while the card's own controls show)
  const box = useRef<HTMLElement>(null);
  const shown = Boolean(course && feed.ready);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setCourseCardOnScreen(e.isIntersecting && e.intersectionRatio > 0.4), { threshold: [0, 0.4, 1] });
    io.observe(el);
    return () => {
      io.disconnect();
      setCourseCardOnScreen(false);
    };
  }, [shown]);
  if (!course || !feed.ready) return null;
  const sw = t.lang === "sw";
  const v = courseView(course, feed.course);
  if (v.total === 0) return null;
  const next = v.current;
  // The card in view: the lesson playing now, otherwise the one he's on (or the last when all are done)
  const playingIdx = v.lessons.findIndex((l) => l.id === playingId);
  const focusIndex = playingIdx >= 0 ? playingIdx : next ? v.lessons.indexOf(next) : v.lessons.length - 1;
  const discreet = feed.settings.discreet;
  const title = discreet ? t("Your course") : pick(sw, course.title, course.titleSw);

  return (
    <section ref={box} className="overflow-hidden rounded-3xl bg-surface ring-1 ring-line lg:flex lg:items-stretch">
      <Link href="/man/course" className="flex items-center gap-4 p-5 pb-4 lg:flex-1 lg:pb-5" aria-label={t("Open the course")}>
        <CourseArt className="concentric h-16 w-16 shrink-0 lg:h-20 lg:w-20" size={26} />
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
          <p className="mt-1.5 text-[0.6875rem] text-ink-soft">
            {t("{done} of {total} lessons", { done: v.done, total: v.total })} · {v.percent}%
          </p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-ink-soft lg:hidden" />
      </Link>

      {/* Every lesson as a card he swipes through; it opens on the lesson he's on (Step 49) */}
      <div className="border-t border-line px-5 pb-4 pt-4 lg:w-[460px] lg:border-l lg:border-t-0">
        <SwipeRow
          id="course-lessons"
          hint={t("Swipe to see other lessons")}
          label={t("Lessons")}
          slideClass="w-[calc(100%-0.5rem)]"
          focus={Math.max(0, focusIndex)}
        >
          {v.lessons.map((l) => (
            <LessonCard key={l.id} lesson={l} course={course} discreet={discreet} sw={sw} />
          ))}
        </SwipeRow>
      </div>
    </section>
  );
}

type ViewLesson = CourseView["lessons"][number];
const IDLE: PlayerState = coursePlayerIdle();
function coursePlayerIdle(): PlayerState {
  return { lesson: null, playing: false, time: 0, duration: 0, parts: [], speed: 1, failed: false, ended: false, countdown: null };
}

/** One lesson in the swipe row: play it right here (audio), or open it. */
type CardProps = { lesson: ViewLesson; course: Course; discreet: boolean; sw: boolean };
function LessonCard(props: CardProps) {
  const mine = useCoursePlayerSelect((s) => s.lesson?.id === props.lesson.id);
  // Only the card that's playing follows the player second by second
  return mine ? <PlayingLessonCard {...props} /> : <LessonCardView {...props} p={null} />;
}
function PlayingLessonCard(props: CardProps) {
  return <LessonCardView {...props} p={useCoursePlayer()} />;
}

function LessonCardView({ lesson: l, course, discreet, sw, p: live }: CardProps & { p: PlayerState | null }) {
  const t = useT();
  const mine = live !== null;
  const p: PlayerState = live ?? IDLE;
  const playing = mine && p.playing;
  const open = l.state === "done" || l.state === "current" || l.state === "open";
  const title = discreet ? t("Lesson {n}", { n: l.number }) : pick(sw, l.title, l.titleSw);
  const mod = course.modules[l.moduleIndex];
  const time = mine ? p.time : l.progress?.pos ?? 0;
  const len = (mine && p.duration) || l.seconds || 0;
  const pct = l.state === "done" && !mine ? 100 : len ? Math.min(100, (time / len) * 100) : 0;
  const KindIcon = l.kind === "video" ? Video : l.kind === "reading" ? BookOpen : Play;
  const waits = lessonAfter(l).mode === "wait" && l.kind !== "reading";
  const href = `/man/course/${l.id}${l.kind === "video" ? "?play=1" : ""}`;

  return (
    <div
      className={`relative flex h-full min-h-[148px] flex-col rounded-2xl p-4 ring-1 transition-colors ${
        l.state === "current" || mine ? "bg-mint/60 ring-forest/30" : "bg-bg ring-line"
      } ${open ? "" : "opacity-75"}`}
    >
      {/* Top: lesson number and state; the countdown sits at the top right when this lesson ends */}
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-[0.6875rem] font-semibold text-forest">
          {t("Lesson {n}", { n: l.number })}
          {!discreet && mod ? ` · ${pick(sw, mod.title, mod.titleSw)}` : ""}
        </p>
        {mine && p.countdown ? null : l.state === "done" ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-forest px-2 py-0.5 text-[0.6875rem] font-bold text-white">
            <Check size={11} /> {t("Done")}
          </span>
        ) : l.state === "locked" ? (
          <Lock size={14} className="shrink-0 text-ink-soft" aria-label={t("Locked")} />
        ) : l.state === "soon" ? (
          <span className="shrink-0 rounded-full bg-line px-2 py-0.5 text-[0.6875rem] font-bold text-ink-soft">{t("Coming soon")}</span>
        ) : null}
      </div>
      {mine && p.countdown && <Countdown forLesson={l.id} tone="light" className="absolute right-2 top-2 z-10" />}

      <Link href={open ? `/man/course/${l.id}` : "/man/course"} className="mt-1 block">
        <span className="line-clamp-2 text-[0.9375rem] font-bold leading-snug">{title}</span>
        <span className="mt-1 flex items-center gap-1.5 text-[0.6875rem] text-ink-soft">
          <KindIcon size={12} aria-hidden />
          {l.kind === "reading" ? t("Reading") : l.kind === "video" ? t("Video") : t("Audio")} ·{" "}
          {time > 1 && l.state !== "done" && l.kind !== "reading" ? t("From {time}", { time: clock(time) }) : t("{n} min", { n: lessonMinutes(l) })}
          {waits && (
            <>
              {" "}
              · <ListChecks size={12} aria-hidden /> {t("Exercise")}
            </>
          )}
        </span>
      </Link>

      <div className="mt-auto flex items-center gap-3 pt-3">
        {open && l.kind === "audio" && l.mediaUrl ? (
          <button
            onClick={() =>
              mine ? coursePlayer.toggle() : coursePlayer.load(toPlayerLesson(course, l, sw), l.progress ?? {}, { autoplay: true, lockLabel: t("Lesson {n}", { n: "{n}" }) })
            }
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest text-white shadow-sm transition-transform active:scale-95"
            aria-label={playing ? t("Pause") : t("Play")}
          >
            {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="translate-x-px" />}
          </button>
        ) : open ? (
          <Link href={href} className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-forest px-4 text-xs font-semibold text-white">
            <KindIcon size={14} /> {l.kind === "reading" ? t("Read") : t("Watch")}
          </Link>
        ) : (
          <span className="text-[0.6875rem] text-ink-soft">
            {l.state === "soon" ? t("We're still adding this lesson.") : t("Opens after lesson {n}", { n: l.number - 1 })}
          </span>
        )}
        {open && l.kind !== "reading" && (
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
            <span className="block h-full rounded-full bg-forest transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </span>
        )}
      </div>
    </div>
  );
}
