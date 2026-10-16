// Shape of a course (Step 48): modules → lessons, built in the Studio (Courses) and played on the Man tab.
// One course is stored as one document: a draft the staff edit, and a published copy men see.

export type LessonKind = "audio" | "video" | "reading";

export interface CourseLesson {
  /** Stable id, never changes (his progress is saved under it). */
  id: string;
  /** Number shown to staff and used to match uploaded files, e.g. "1.0", "4.8.1". */
  code: string;
  title: string;
  titleSw?: string;
  kind: LessonKind;
  /** Uploaded audio or video. */
  mediaUrl?: string;
  /** Length of the audio/video in seconds (read from the file when it's uploaded). */
  seconds?: number;
  summary?: string;
  summarySw?: string;
  keyPoints?: string[];
  keyPointsSw?: string[];
  /** Reading lessons: paragraphs ("## " = heading). Written in Kiswahili first. */
  bodySw?: string[];
  body?: string[];
  /** Shown in a yellow box above the player (e.g. a safety warning). */
  caution?: string;
  cautionSw?: string;
  /** Points for finishing it. */
  points: number;
  /** Hidden lessons stay in the Studio but men never see them. */
  hidden?: boolean;
  /** Private note for staff (never shown to men). */
  staffNote?: string;
  /**
   * What happens when it ends (Step 49): "auto" = the next lesson starts after a 10-second countdown;
   * "wait" = he has something to do first (answer questions, do an exercise), so it waits for him.
   * Not set: reading lessons and the known exercise lessons wait, everything else goes on automatically.
   */
  after?: "auto" | "wait";
  /** For "wait" lessons: what he should do before moving on, e.g. "Do the exercise with the audio". */
  task?: string;
  taskSw?: string;
}

export interface CourseModule {
  id: string;
  title: string;
  titleSw?: string;
  lessons: CourseLesson[];
}

export interface Course {
  version: 1;
  id: string;
  title: string;
  titleSw?: string;
  summary: string;
  summarySw?: string;
  /** Ownership line shown on every lesson. */
  credit: string;
  creditSw?: string;
  /** Share of an audio/video he must hear before the next lesson opens. */
  passPercent: number;
  modules: CourseModule[];
}

/** What men see: hidden lessons (and empty modules) removed. */
export function visibleCourse(c: Course): Course {
  return {
    ...c,
    modules: c.modules
      .map((m) => ({ ...m, lessons: m.lessons.filter((l) => !l.hidden) }))
      .filter((m) => m.lessons.length > 0),
  };
}

export type FlatLesson = CourseLesson & { moduleId: string; moduleIndex: number; index: number; number: number };

/** All lessons in order, with their place in the course (number = 1, 2, 3… for men). */
export function flatLessons(c: Course): FlatLesson[] {
  const out: FlatLesson[] = [];
  c.modules.forEach((m, mi) =>
    m.lessons.forEach((l, li) => out.push({ ...l, moduleId: m.id, moduleIndex: mi, index: li, number: out.length + 1 })),
  );
  return out;
}

/** Minutes shown on a lesson (at least 1). Reading lessons: about 200 words a minute. */
export function lessonMinutes(l: CourseLesson): number {
  if (l.kind !== "reading") return Math.max(1, Math.round((l.seconds ?? 0) / 60));
  const words = [...(l.bodySw ?? []), ...(l.body ?? [])].join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Can a man play this lesson? Audio/video need a file; reading needs text. */
export function lessonReady(l: CourseLesson): boolean {
  if (l.kind === "reading") return Boolean(l.bodySw?.length || l.body?.length);
  return Boolean(l.mediaUrl);
}

/* ───────────── After a lesson (Step 49) ───────────── */

const EXERCISE = {
  task: "Do the exercise along with the audio. When you've done it, go on to the next lesson.",
  taskSw: "Fanya zoezi pamoja na sauti. Ukimaliza, endelea na somo linalofuata.",
};
/** Lessons in the MTIE Wazimu outline where he has something to do before moving on. */
const WAIT_BY_ID: Record<string, { task: string; taskSw: string }> = {
  "wz-1-1": { task: "Write your answers in your notebook first.", taskSw: "Andika majibu yako kwenye notebook kwanza." },
  "wz-2-2-1": { task: "Write your own affirmations first.", taskSw: "Andika affirmation zako mwenyewe kwanza." },
  "wz-6-0": EXERCISE,
  "wz-6-1": EXERCISE,
  "wz-6-2": EXERCISE,
  "wz-6-3": EXERCISE,
  "wz-6-8": { task: "Plan when you'll train this week, then go on.", taskSw: "Panga siku utakazofanya mazoezi wiki hii, kisha endelea." },
};

export interface AfterLesson {
  mode: "auto" | "wait";
  task?: string;
  taskSw?: string;
}

/** Does the next lesson start by itself, or does this lesson wait for him? */
export function lessonAfter(l: Pick<CourseLesson, "id" | "kind" | "after" | "task" | "taskSw">): AfterLesson {
  const known = WAIT_BY_ID[l.id];
  const mode = l.after ?? (l.kind === "reading" || known ? "wait" : "auto");
  if (mode === "auto") return { mode };
  return { mode, task: l.task || known?.task, taskSw: l.taskSw || known?.taskSw };
}
