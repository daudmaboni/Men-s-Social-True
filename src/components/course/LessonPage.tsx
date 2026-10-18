"use client";

// One course lesson (Step 48): audio player, video, or reading.
// - Continues from where he stopped (on any of his phones).
// - Counts only what he actually listens to: when he has heard the pass share (70%), the lesson is
//   finished, points are added and the next lesson opens.
// - Lock screen shows only "Lesson 5 · Men's Social", never the lesson title.
// - Step 49: audio plays in the app-wide player (keeps playing on other pages, mini player), a 10-second
//   countdown to the next lesson at the top right when it ends, and lessons that wait for him show what to do.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ListChecks, ListOrdered, Lock, Pause, Play, RotateCcw, RotateCw, ShieldCheck } from "lucide-react";
import CourseArt from "./CourseArt";
import Countdown from "./Countdown";
import { toPlayerLesson } from "./CoursePlayerHost";
import { coursePlayer, useCoursePlayer } from "@/lib/course/player";
import { useToast } from "@/components/motion/Toast";
import { feedStore, useFeed } from "@/lib/feed/store";
import { pick, useMainCourse } from "@/lib/course/useCourses";
import { clock, courseView, heardStep, passReached, passSeconds } from "@/lib/course/progress";
import { lessonAfter, lessonMinutes, type Course, type FlatLesson } from "@/lib/course/types";
import { useT } from "@/lib/i18n";
import { useMediaSrc } from "@/lib/course/media";

const SPEEDS = [1, 1.25, 1.5, 0.75];

export default function LessonPage({ id }: { id: string }) {
  const { course, ready } = useMainCourse();
  const feed = useFeed();
  const t = useT();
  const sw = t.lang === "sw";

  const back = (
    <Link href="/man/course" className="flex items-center gap-1 text-sm text-ink-soft">
      <ArrowLeft size={16} /> {t("Course")}
    </Link>
  );

  if (!course || !feed.ready) {
    return (
      <div className="space-y-4">
        {back}
        {ready && !course ? (
          <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
            <p className="font-semibold">{t("This lesson isn't available")}</p>
          </div>
        ) : (
          <div className="h-72 animate-pulse rounded-[28px] bg-forest-deep/15" />
        )}
      </div>
    );
  }

  const v = courseView(course, feed.course);
  const i = v.lessons.findIndex((l) => l.id === id);
  const lesson = v.lessons[i];
  if (!lesson) {
    return (
      <div className="space-y-4">
        {back}
        <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
          <p className="font-semibold">{t("This lesson isn't available")}</p>
          <p className="mt-1 text-sm text-ink-soft">{t("It may have been moved or removed.")}</p>
        </div>
      </div>
    );
  }
  if (lesson.state === "locked" || lesson.state === "soon") {
    return (
      <div className="space-y-4">
        {back}
        <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
          <Lock className="mx-auto text-ink-soft" size={26} />
          <p className="mt-2 font-semibold">{lesson.state === "soon" ? t("Coming soon") : t("This lesson opens soon")}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {lesson.state === "soon" ? t("We're still adding this lesson.") : t("Finish the lessons before it, one after another.")}
          </p>
          {v.current && (
            <Link href={`/man/course/${v.current.id}`} className="mt-4 inline-block rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white">
              {t("Go to lesson {n}", { n: v.current.number })}
            </Link>
          )}
        </div>
      </div>
    );
  }

  const mod = course.modules[lesson.moduleIndex];
  const nextLesson = v.lessons.slice(i + 1).find((l) => l.state !== "soon") ?? null;
  const done = lesson.state === "done";
  const caution = pick(sw, lesson.caution, lesson.cautionSw);
  const summary = pick(sw, lesson.summary, lesson.summarySw);
  const points = (sw ? lesson.keyPointsSw : lesson.keyPoints) ?? lesson.keyPoints ?? lesson.keyPointsSw;

  return (
    <article className="stagger space-y-5" key={lesson.id}>
      <div className="flex items-center justify-between">
        {back}
        <span className="text-xs font-semibold text-ink-soft">
          {t("Lesson {n} of {total}", { n: lesson.number, total: v.lessons.filter((l) => l.state !== "soon").length })}
        </span>
      </div>

      {lesson.kind === "reading" ? (
        <header className="rounded-[28px] bg-forest-deep p-5 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-mint-strong">
            {t("Module {n}", { n: lesson.moduleIndex + 1 })} · {pick(sw, mod.title, mod.titleSw)}
          </p>
          <h1 className="mt-2 text-[24px] font-bold leading-tight">{pick(sw, lesson.title, lesson.titleSw)}</h1>
          <p className="mt-1 text-xs text-mint">{t("Reading")} · {t("{n} min", { n: lessonMinutes(lesson) })}</p>
        </header>
      ) : (
        lesson.kind === "audio" ? (
          <AudioPlayer course={course} lesson={lesson} moduleTitle={pick(sw, mod.title, mod.titleSw)} done={done} />
        ) : (
          <Player course={course} lesson={lesson} moduleTitle={pick(sw, mod.title, mod.titleSw)} done={done} hasNext={Boolean(nextLesson)} />
        )
      )}

      {caution && (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 dark:ring-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{caution}</span>
        </p>
      )}

      {summary && <p className="px-1 text-[15px] leading-relaxed text-ink-soft">{summary}</p>}

      {lesson.kind === "reading" && <Reading lesson={lesson} done={done} hasNext={Boolean(nextLesson)} />}

      {points && points.length > 0 && (
        <div className="rounded-3xl bg-surface p-5 ring-1 ring-line">
          <h2 className="font-bold">{t("Key points")}</h2>
          <ol className="mt-3 space-y-2">
            {points.map((k, n) => (
              <li key={n} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint text-xs font-bold text-forest">{n + 1}</span>
                {k}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Lessons that wait for him: what to do before moving on */}
      {(() => {
        const after = lessonAfter(lesson);
        const task = pick(sw, after.task, after.taskSw);
        return after.mode === "wait" && task && nextLesson ? (
          <p className="flex items-start gap-2 rounded-2xl bg-mint/60 p-4 text-sm text-forest-deep">
            <ListChecks size={16} className="mt-0.5 shrink-0" />
            <span>
              <b className="font-semibold">{t("Before the next lesson")}:</b> {task}
            </span>
          </p>
        ) : null;
      })()}

      {done && nextLesson ? (
        <Link
          href={`/man/course/${nextLesson.id}${nextLesson.kind === "reading" ? "" : "?play=1"}`}
          className="flex w-full items-center gap-3 rounded-3xl bg-forest p-4 text-white transition-transform active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
            <ArrowRight size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold text-mint-strong">{t("Next lesson")} · {nextLesson.number}</span>
            <span className="block truncate text-sm font-semibold">{pick(sw, nextLesson.title, nextLesson.titleSw)}</span>
          </span>
        </Link>
      ) : done && !nextLesson && v.finished ? (
        <div className="rounded-3xl bg-mint p-5 text-center">
          <p className="text-lg font-bold text-forest-deep">{t("Course complete. Well done!")}</p>
          <p className="mt-1 text-sm text-forest">{t("Listen to any lesson again, any time.")}</p>
        </div>
      ) : null}

      <Link href="/man/course" className="flex items-center justify-center gap-1.5 rounded-full py-3 text-sm font-semibold text-ink ring-1 ring-line">
        <ListOrdered size={16} /> {t("All lessons")}
      </Link>

      <p className="flex items-start gap-1.5 rounded-2xl bg-bg px-3 py-2 text-[11px] leading-snug text-ink-soft ring-1 ring-line">
        <ShieldCheck size={13} className="mt-px shrink-0 text-forest" />
        <span>{pick(sw, course.credit, course.creditSw)}</span>
      </p>
      <p className="px-2 text-center text-[11px] text-ink-soft">{t("General education, not medical advice.")}</p>
    </article>
  );
}

/* ───────────── Audio (app-wide player, Step 49) ───────────── */

function AudioPlayer({ course, lesson, moduleTitle, done }: { course: Course; lesson: FlatLesson & { state: string; progress?: { pos: number; heard: number } }; moduleTitle: string; done: boolean }) {
  const t = useT();
  const sw = t.lang === "sw";
  const params = useSearchParams();
  const p = useCoursePlayer();
  const mine = p.lesson?.id === lesson.id;
  const load = useCallback(
    (autoplay: boolean) => coursePlayer.load(toPlayerLesson(course, lesson, sw), lesson.progress ?? {}, { autoplay, lockLabel: t("Lesson {n}", { n: "{n}" }) }),
    [course, lesson, sw, t],
  );

  // "Play" on the course card brings him here with ?play=1: start straight away
  useEffect(() => {
    if (params.get("play") === "1" && coursePlayer.get().lesson?.id !== lesson.id) load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  const time = mine ? p.time : lesson.progress?.pos ?? 0;
  const duration = (mine && p.duration) || lesson.seconds || 0;
  const heard = mine ? p.heard : lesson.progress?.heard ?? 0;
  const playing = mine && p.playing;
  const finished = done || (mine && Boolean(p.lesson?.done));
  const need = passSeconds(duration, course.passPercent);
  const heardPct = duration ? Math.min(100, Math.round((heard / duration) * 100)) : 0;
  const SPEED_LIST = SPEEDS;

  return (
    <section className="relative overflow-hidden rounded-[28px] bg-forest-deep text-white">
      {/* "Next lesson in 10" when it ends */}
      <Countdown forLesson={lesson.id} className="absolute right-3 top-3 z-10" />
      <div className="flex justify-center pt-7">
        <CourseArt className={`h-28 w-28 rounded-[28px] shadow-lg transition-transform duration-500 ${playing ? "scale-105" : ""}`} size={40} />
      </div>
      <div className="px-5 pb-5 pt-5 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-mint-strong">
          {t("Module {n}", { n: lesson.moduleIndex + 1 })} · {moduleTitle}
        </p>
        <h1 className="mt-1.5 text-[24px] font-bold leading-tight">{pick(sw, lesson.title, lesson.titleSw)}</h1>
        {!sw && <p className="mt-1 text-xs text-mint">{t("In Kiswahili")}</p>}

        <input
          type="range"
          min={0}
          max={Math.max(duration, 1)}
          step={1}
          value={Math.min(time, duration || time)}
          disabled={!mine}
          onChange={(e) => coursePlayer.seek(Number(e.target.value))}
          aria-label={t("Position in the lesson")}
          className="course-range mt-5 w-full disabled:opacity-60"
          style={{ ["--pct" as string]: `${duration ? (time / duration) * 100 : 0}%` }}
        />
        <div className="mt-1 flex justify-between text-left text-[11px] tabular-nums text-mint">
          <span>{clock(time)}</span>
          <span>-{clock(Math.max(0, duration - time))}</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => coursePlayer.setSpeed(SPEED_LIST[(SPEED_LIST.indexOf(p.speed) + 1) % SPEED_LIST.length])}
            className="flex h-10 w-14 items-center justify-center rounded-full bg-white/10 text-xs font-bold tabular-nums"
            aria-label={t("Playback speed")}
          >
            {p.speed}×
          </button>
          <button onClick={() => mine && coursePlayer.skip(-15)} disabled={!mine} className="relative flex h-12 w-12 items-center justify-center rounded-full text-white disabled:opacity-40" aria-label={t("Back 15 seconds")}>
            <RotateCcw size={26} />
            <span className="absolute text-[9px] font-bold">15</span>
          </button>
          <button
            onClick={() => (mine ? coursePlayer.toggle() : load(true))}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-mint-strong text-forest-deep shadow-lg transition-transform active:scale-95"
            aria-label={playing ? t("Pause") : t("Play")}
          >
            {playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" className="translate-x-0.5" />}
          </button>
          <button onClick={() => mine && coursePlayer.skip(15)} disabled={!mine} className="relative flex h-12 w-12 items-center justify-center rounded-full text-white disabled:opacity-40" aria-label={t("Forward 15 seconds")}>
            <RotateCw size={26} />
            <span className="absolute text-[9px] font-bold">15</span>
          </button>
          <span className="w-14" />
        </div>

        {mine && p.failed && <p className="mt-3 rounded-2xl bg-white/10 p-3 text-left text-xs text-mint">{t("This lesson couldn't play. Check your internet and try again.")}</p>}

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2.5 text-left text-xs text-mint">
          {finished ? (
            <>
              <Check size={15} className="shrink-0 text-mint-strong" /> {t("Lesson finished · +{n} points", { n: lesson.points })}
            </>
          ) : (
            <span className="min-w-0 flex-1">
              <span className="block">{t("{n}% heard · the next lesson opens at {pass}%", { n: heardPct, pass: course.passPercent })}</span>
              <span className="relative mt-2 block h-1.5 overflow-hidden rounded-full bg-white/15">
                <span className="absolute inset-y-0 left-0 rounded-full bg-mint-strong" style={{ width: `${Math.min(100, (heard / Math.max(need, 1)) * 100)}%` }} />
              </span>
            </span>
          )}
        </div>
        <p className="mt-2 text-[11px] text-mint/80">{t("Keeps playing when you leave this page.")}</p>
      </div>
    </section>
  );
}

/* ───────────── Video ───────────── */

function Player({ course, lesson, moduleTitle, done, hasNext }: { course: Course; lesson: FlatLesson & { progress?: { pos: number; heard: number } }; moduleTitle: string; done: boolean; hasNext: boolean }) {
  const t = useT();
  const sw = t.lang === "sw";
  const showToast = useToast();
  const params = useSearchParams();
  const audio = useRef<HTMLAudioElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const media = useCallback(() => (lesson.kind === "video" ? video.current : audio.current), [lesson.kind]);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(lesson.progress?.pos ?? 0);
  const [duration, setDuration] = useState(lesson.seconds ?? 0);
  const [speed, setSpeed] = useState(1);
  const [heard, setHeard] = useState(lesson.progress?.heard ?? 0);
  const [failed, setFailed] = useState(false);

  // Kept in refs so the event handlers always see the latest values
  const heardRef = useRef(lesson.progress?.heard ?? 0);
  const prev = useRef(lesson.progress?.pos ?? 0);
  const lastSave = useRef(0);
  const doneRef = useRef(done);
  doneRef.current = done;

  const save = useCallback(() => {
    const el = media();
    if (!el) return;
    feedStore.saveCourseSpot(lesson.id, el.ended ? 0 : el.currentTime, heardRef.current);
    lastSave.current = Date.now();
  }, [lesson.id, media]);

  const checkPass = useCallback(
    (len: number) => {
      if (doneRef.current || !passReached(heardRef.current, len, course.passPercent)) return;
      doneRef.current = true;
      feedStore.saveCourseSpot(lesson.id, media()?.currentTime ?? 0, heardRef.current);
      feedStore.finishCourseLesson(lesson.id, lesson.points);
      showToast(hasNext ? t("+{n} points · Next lesson open", { n: lesson.points }) : t("+{n} points", { n: lesson.points }));
    },
    [course.passPercent, hasNext, lesson.id, lesson.points, media, showToast, t],
  );

  // Start where he stopped; play straight away when he pressed Play on the card
  const onLoaded = () => {
    const el = media();
    if (!el) return;
    const len = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : lesson.seconds ?? 0;
    setDuration(len);
    const pos = lesson.progress?.pos ?? 0;
    if (pos > 0 && pos < len - 5) el.currentTime = pos;
    prev.current = el.currentTime;
    if (params.get("play") === "1") el.play().catch(() => {});
  };

  const onTime = () => {
    const el = media();
    if (!el) return;
    const add = heardStep(prev.current, el.currentTime, el.playbackRate);
    prev.current = el.currentTime;
    if (add) {
      const len = duration || el.duration || 0;
      heardRef.current = Math.min(heardRef.current + add, len || Infinity);
      setHeard(heardRef.current);
      checkPass(len);
    }
    setTime(el.currentTime);
    if (Date.now() - lastSave.current > 5000) save();
  };

  // Save when he leaves the page or the app goes to the background
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && save();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      save();
    };
  }, [save]);

  // Lock screen: discreet title, and the usual buttons
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: t("Lesson {n}", { n: lesson.number }), artist: "Men's Social" });
    const jump = (s: number) => () => {
      const el = media();
      if (el) el.currentTime = Math.max(0, Math.min(el.currentTime + s, el.duration || Infinity));
    };
    navigator.mediaSession.setActionHandler("play", () => void media()?.play());
    navigator.mediaSession.setActionHandler("pause", () => media()?.pause());
    navigator.mediaSession.setActionHandler("seekbackward", jump(-15));
    navigator.mediaSession.setActionHandler("seekforward", jump(15));
    return () => {
      for (const a of ["play", "pause", "seekbackward", "seekforward"] as const) navigator.mediaSession.setActionHandler(a, null);
    };
  }, [lesson.number, media, t]);

  const toggle = () => {
    const el = media();
    if (!el) return;
    if (el.paused) el.play().catch(() => setFailed(true));
    else el.pause();
  };
  const skip = (s: number) => {
    const el = media();
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.currentTime + s, (el.duration || duration) - 0.5));
    prev.current = el.currentTime;
    setTime(el.currentTime);
  };
  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    const el = media();
    if (el) el.playbackRate = next;
  };

  const need = passSeconds(duration || lesson.seconds || 0, course.passPercent);
  const mediaSrc = useMediaSrc(lesson.mediaUrl); // private files: a one-day link (Step 59)
  const heardPct = duration ? Math.min(100, Math.round((heard / duration) * 100)) : 0;
  const common = {
    src: mediaSrc || undefined,
    preload: "metadata" as const,
    onLoadedMetadata: onLoaded,
    onTimeUpdate: onTime,
    onPlay: () => {
      setPlaying(true);
      coursePlayer.pause(); // a video lesson takes over from any audio lesson
    },
    onPause: () => {
      setPlaying(false);
      save();
    },
    onEnded: () => {
      setPlaying(false);
      save();
    },
    onSeeked: () => {
      prev.current = media()?.currentTime ?? 0;
    },
    onError: () => setFailed(true),
  };

  return (
    <section className="overflow-hidden rounded-[28px] bg-forest-deep text-white">
      {lesson.kind === "video" ? (
        <video ref={video} {...common} controls playsInline className="aspect-video w-full bg-black" />
      ) : (
        <>
          <audio ref={audio} {...common} />
          <div className="flex justify-center pt-7">
            <CourseArt className={`h-28 w-28 rounded-[28px] shadow-lg transition-transform duration-500 ${playing ? "scale-105" : ""}`} size={40} />
          </div>
        </>
      )}
      <div className={`px-5 pb-5 ${lesson.kind === "video" ? "pt-4" : "pt-5 text-center"}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-mint-strong">
          {t("Module {n}", { n: lesson.moduleIndex + 1 })} · {moduleTitle}
        </p>
        <h1 className="mt-1.5 text-[24px] font-bold leading-tight">{pick(sw, lesson.title, lesson.titleSw)}</h1>
        {!sw && <p className="mt-1 text-xs text-mint">{t("In Kiswahili")}</p>}

        {lesson.kind === "audio" && (
          <>
            <input
              type="range"
              min={0}
              max={Math.max(duration, 1)}
              step={1}
              value={Math.min(time, duration || time)}
              onChange={(e) => {
                const el = media();
                if (!el) return;
                el.currentTime = Number(e.target.value);
                prev.current = el.currentTime;
                setTime(el.currentTime);
              }}
              aria-label={t("Position in the lesson")}
              className="course-range mt-5 w-full"
              style={{ ["--pct" as string]: `${duration ? (time / duration) * 100 : 0}%` }}
            />
            <div className="mt-1 flex justify-between text-left text-[11px] tabular-nums text-mint">
              <span>{clock(time)}</span>
              <span>-{clock(Math.max(0, duration - time))}</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <button onClick={cycleSpeed} className="flex h-10 w-14 items-center justify-center rounded-full bg-white/10 text-xs font-bold tabular-nums" aria-label={t("Playback speed")}>
                {speed}×
              </button>
              <button onClick={() => skip(-15)} className="relative flex h-12 w-12 items-center justify-center rounded-full text-white" aria-label={t("Back 15 seconds")}>
                <RotateCcw size={26} />
                <span className="absolute text-[9px] font-bold">15</span>
              </button>
              <button
                onClick={toggle}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-mint-strong text-forest-deep shadow-lg transition-transform active:scale-95"
                aria-label={playing ? t("Pause") : t("Play")}
              >
                {playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" className="translate-x-0.5" />}
              </button>
              <button onClick={() => skip(15)} className="relative flex h-12 w-12 items-center justify-center rounded-full text-white" aria-label={t("Forward 15 seconds")}>
                <RotateCw size={26} />
                <span className="absolute text-[9px] font-bold">15</span>
              </button>
              <span className="w-14" />
            </div>
          </>
        )}

        {failed && <p className="mt-3 rounded-2xl bg-white/10 p-3 text-left text-xs text-mint">{t("This lesson couldn't play. Check your internet and try again.")}</p>}

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2.5 text-left text-xs text-mint">
          {done ? (
            <>
              <Check size={15} className="shrink-0 text-mint-strong" /> {t("Lesson finished · +{n} points", { n: lesson.points })}
            </>
          ) : (
            <span className="min-w-0 flex-1">
              <span className="block">{t("{n}% heard · the next lesson opens at {pass}%", { n: heardPct, pass: course.passPercent })}</span>
              <span className="relative mt-2 block h-1.5 overflow-hidden rounded-full bg-white/15">
                <span className="absolute inset-y-0 left-0 rounded-full bg-mint-strong" style={{ width: `${Math.min(100, (heard / Math.max(need, 1)) * 100)}%` }} />
              </span>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

/* ───────────── Reading ───────────── */

function Reading({ lesson, done, hasNext }: { lesson: FlatLesson; done: boolean; hasNext: boolean }) {
  const t = useT();
  const showToast = useToast();
  const [lang, setLang] = useState<"en" | "sw">(t.lang === "sw" || !lesson.body?.length ? "sw" : "en");
  const body = (lang === "sw" ? lesson.bodySw : lesson.body) ?? lesson.bodySw ?? lesson.body ?? [];
  const both = Boolean(lesson.body?.length && lesson.bodySw?.length);
  return (
    <>
      {both && (
        <div className="inline-flex rounded-full bg-surface p-1 text-xs font-semibold ring-1 ring-line" role="tablist" aria-label={t("Language")}>
          {(["en", "sw"] as const).map((l) => (
            <button key={l} role="tab" aria-selected={lang === l} onClick={() => setLang(l)} className={`rounded-full px-3 py-1.5 ${lang === l ? "bg-forest text-white" : "text-ink-soft"}`}>
              {l === "en" ? "English" : "Kiswahili"}
            </button>
          ))}
        </div>
      )}
      <div lang={lang} className="space-y-3 rounded-3xl bg-surface p-5 text-[15px] leading-relaxed ring-1 ring-line">
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
      <button
        onClick={() => {
          if (done) return;
          feedStore.finishCourseLesson(lesson.id, lesson.points);
          showToast(hasNext ? t("+{n} points · Next lesson open", { n: lesson.points }) : t("+{n} points", { n: lesson.points }));
        }}
        className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-transform active:scale-[0.98] ${done ? "bg-mint text-forest" : "bg-forest text-white"}`}
      >
        {done ? (
          <>
            <Check size={16} /> {t("You've read this")}
          </>
        ) : (
          t("I've read it · +{n} points", { n: lesson.points })
        )}
      </button>
    </>
  );
}
