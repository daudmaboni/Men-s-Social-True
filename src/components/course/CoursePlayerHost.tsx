"use client";

// Mounted once in the app (Step 49). Connects the app-wide lesson player to the course:
// - says "+10 points · Next lesson open" when a lesson is finished (wherever he is),
// - when an audio lesson ends: starts the 10-second countdown to the next lesson, unless the lesson
//   waits for him (questions, exercises),
// - when the countdown ends: the next lesson starts (audio) and the lesson page moves along with it.

import { haptic } from "@/lib/motion/haptics";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/motion/Toast";
import { useFeed } from "@/lib/feed/store";
import { pick, useMainCourse } from "@/lib/course/useCourses";
import { courseView } from "@/lib/course/progress";
import { coursePlayer, playerHooks, type PlayerLesson } from "@/lib/course/player";
import { lessonAfter, type Course, type FlatLesson } from "@/lib/course/types";
import { useT } from "@/lib/i18n";

/** What the player needs to know about a lesson. */
export function toPlayerLesson(course: Course, l: FlatLesson & { state?: string }, sw: boolean): PlayerLesson {
  return {
    id: l.id,
    number: l.number,
    title: pick(sw, l.title, l.titleSw),
    mediaUrl: l.mediaUrl ?? "",
    seconds: l.seconds,
    passPercent: course.passPercent,
    points: l.points,
    done: l.state === "done",
  };
}

/** The lesson that comes after this one (skipping "coming soon" ones). */
export function nextAfter(course: Course, progress: Parameters<typeof courseView>[1], id: string) {
  const v = courseView(course, progress);
  const i = v.lessons.findIndex((l) => l.id === id);
  return i < 0 ? null : (v.lessons.slice(i + 1).find((l) => l.state !== "soon") ?? null);
}

export default function CoursePlayerHost() {
  const { course } = useMainCourse();
  const feed = useFeed();
  const t = useT();
  const showToast = useToast();
  const router = useRouter();
  const pathname = usePathname();

  // The hooks are called from the player, outside React: they read the latest values from here
  const latest = useRef({ course, feed, t, showToast, router, pathname });
  latest.current = { course, feed, t, showToast, router, pathname };

  useEffect(() => {
    playerHooks.onFinish = (l) => {
      const { course, feed, t, showToast } = latest.current;
      const hasNext = course ? Boolean(nextAfter(course, feed.course, l.id)) : false;
      haptic("success");
      showToast(hasNext ? t("+{n} points · Next lesson open", { n: l.points }) : t("+{n} points", { n: l.points }));
    };
    playerHooks.onEnded = (l) => {
      const { course, feed } = latest.current;
      if (!course) return;
      const lesson = courseView(course, feed.course).lessons.find((x) => x.id === l.id);
      if (!lesson || lessonAfter(lesson).mode === "wait") return; // he has something to do first
      const next = nextAfter(course, feed.course, l.id);
      if (next && next.state !== "locked") coursePlayer.startCountdown(next.id);
    };
    playerHooks.onCountdownDone = (nextId, fromId) => {
      const { course, feed, t, router, pathname } = latest.current;
      if (!course) return;
      const sw = t.lang === "sw";
      const next = courseView(course, feed.course).lessons.find((x) => x.id === nextId);
      if (!next) return;
      if (next.kind === "audio" && next.mediaUrl) {
        coursePlayer.load(toPlayerLesson(course, next, sw), next.progress ?? {}, { autoplay: true, lockLabel: t("Lesson {n}", { n: "{n}" }) });
      } else {
        coursePlayer.stop(); // a video or reading lesson: he opens it himself
      }
      // On the lesson page, the page moves to the next lesson too
      if (pathname === `/man/course/${fromId}`) router.replace(`/man/course/${nextId}`, { scroll: true });
    };
    return () => {
      playerHooks.onFinish = undefined;
      playerHooks.onEnded = undefined;
      playerHooks.onCountdownDone = undefined;
    };
  }, []);

  return null;
}
