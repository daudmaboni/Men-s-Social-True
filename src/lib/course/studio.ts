// Studio helpers for courses (Step 48): publishing checks, matching uploaded files to lessons,
// and small edits (add, move, remove). Pure functions, so they're easy to test.

import { checkClaims, type ClaimIssue } from "../studio/claims";
import { flatLessons, type Course, type CourseLesson, type CourseModule, type FlatLesson } from "./types";

export interface CourseIssue {
  level: "block" | "warn";
  message: string;
  /** Lesson code (or "" for the whole course), so the editor can jump to it. */
  where: string;
}

/** Can this course be published? BLOCK = no, WARN = yes, but look again. */
export function checkCourse(c: Course): CourseIssue[] {
  const issues: CourseIssue[] = [];
  if (!c.title.trim()) issues.push({ level: "block", message: "The course needs a title.", where: "" });
  if (!c.credit.trim()) issues.push({ level: "warn", message: "Add the ownership line (e.g. © Kayani Herbs).", where: "" });
  const all = flatLessons(c);
  const ids = new Set<string>();
  for (const l of all) {
    if (ids.has(l.id)) issues.push({ level: "block", message: "Two lessons have the same id.", where: l.code });
    ids.add(l.id);
  }
  const visible = all.filter((l) => !l.hidden);
  if (!visible.length) issues.push({ level: "block", message: "There are no visible lessons.", where: "" });
  for (const l of visible) {
    if (!l.title.trim()) issues.push({ level: "block", message: "A lesson has no title.", where: l.code });
    if (l.kind !== "reading" && !l.mediaUrl) issues.push({ level: "block", message: `No ${l.kind} uploaded yet.`, where: l.code });
    if (l.kind !== "reading" && l.mediaUrl && !l.seconds) issues.push({ level: "warn", message: "Length unknown: the 70% rule can't work. Upload the file again.", where: l.code });
    if (l.kind === "reading" && !(l.bodySw?.length || l.body?.length)) issues.push({ level: "block", message: "Reading lesson has no text.", where: l.code });
    for (const i of claimsFor(l)) issues.push({ level: i.level, message: `${i.message} ("${i.match}")`, where: l.code });
  }
  const hidden = all.filter((l) => l.hidden).length;
  if (hidden) issues.push({ level: "warn", message: `${hidden} hidden lesson${hidden === 1 ? "" : "s"} won't be shown to men.`, where: "" });
  return issues.sort((a, b) => (a.level === b.level ? 0 : a.level === "block" ? -1 : 1));
}

function claimsFor(l: CourseLesson): ClaimIssue[] {
  return checkClaims({
    title: l.title,
    titleSw: l.titleSw,
    summary: [l.summary, l.summarySw].filter(Boolean).join("\n"),
    body: [...(l.body ?? []), ...(l.keyPoints ?? [])],
    bodySw: [...(l.bodySw ?? []), ...(l.keyPointsSw ?? [])],
  });
}

/** Which lesson a file is for, from the number at the start of its name ("4.8.1 - …", "Lesson 2.0---…"). */
export function matchUpload(fileName: string, lessons: FlatLesson[]): FlatLesson | null {
  const m = /^(?:lesson\s*)?(\d+(?:\.\d+)*)/i.exec(fileName.trim());
  if (!m) return null;
  const code = m[1].replace(/\.$/, "");
  return lessons.find((l) => l.code === code) ?? null;
}

/** Next free code in a module, e.g. after "4.8.1" in module 4 → "4.9". */
function nextCode(c: Course, moduleIndex: number): string {
  const nums = c.modules[moduleIndex]?.lessons.map((l) => Number(l.code.split(".")[1] ?? 0)).filter((n) => !Number.isNaN(n)) ?? [];
  const major = /^m(\d+)$/.exec(c.modules[moduleIndex]?.id ?? "")?.[1] ?? String(moduleIndex + 1);
  let n = nums.length ? Math.max(...nums) + 1 : 0;
  const used = new Set(flatLessons(c).map((l) => l.code));
  while (used.has(`${major}.${n}`)) n++;
  return `${major}.${n}`;
}

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function addLesson(c: Course, moduleIndex: number): { course: Course; lesson: CourseLesson } {
  const lesson: CourseLesson = { id: uid(`${c.id.slice(0, 2)}l`), code: nextCode(c, moduleIndex), title: "New lesson", kind: "audio", points: 10 };
  return { course: updateModule(c, moduleIndex, (m) => ({ ...m, lessons: [...m.lessons, lesson] })), lesson };
}

export function addModule(c: Course): Course {
  const n = c.modules.length + 1;
  let id = `m${n}`;
  while (c.modules.some((m) => m.id === id)) id = `${id}x`;
  return { ...c, modules: [...c.modules, { id, title: `Module ${n}`, lessons: [] }] };
}

export function updateModule(c: Course, moduleIndex: number, fn: (m: CourseModule) => CourseModule): Course {
  return { ...c, modules: c.modules.map((m, i) => (i === moduleIndex ? fn(m) : m)) };
}

export function updateLesson(c: Course, lessonId: string, fn: (l: CourseLesson) => CourseLesson): Course {
  return { ...c, modules: c.modules.map((m) => ({ ...m, lessons: m.lessons.map((l) => (l.id === lessonId ? fn(l) : l)) })) };
}

export function removeLesson(c: Course, lessonId: string): Course {
  return { ...c, modules: c.modules.map((m) => ({ ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) })) };
}

/** Move an item one place up (-1) or down (+1). */
export function move<T>(list: T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** Move a lesson up or down; at the edge of a module it moves into the next/previous module. */
export function moveLesson(c: Course, lessonId: string, by: -1 | 1): Course {
  const mi = c.modules.findIndex((m) => m.lessons.some((l) => l.id === lessonId));
  if (mi < 0) return c;
  const li = c.modules[mi].lessons.findIndex((l) => l.id === lessonId);
  const lessons = c.modules[mi].lessons;
  if ((by === -1 && li > 0) || (by === 1 && li < lessons.length - 1)) return updateModule(c, mi, (m) => ({ ...m, lessons: move(m.lessons, li, by) }));
  const target = mi + by;
  if (target < 0 || target >= c.modules.length) return c;
  const lesson = lessons[li];
  const without = updateModule(c, mi, (m) => ({ ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) }));
  return updateModule(without, target, (m) => ({ ...m, lessons: by === 1 ? [lesson, ...m.lessons] : [...m.lessons, lesson] }));
}

/** Lines of text ↔ list (one paragraph or key point per line, empty lines dropped). */
export const toLines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
export const fromLines = (a?: string[]) => (a ?? []).join("\n");
