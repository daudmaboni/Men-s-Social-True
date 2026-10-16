import { describe, expect, it } from "vitest";
import { courseView, heardStep, passReached, passSeconds, clock } from "./progress";
import { flatLessons, lessonMinutes, visibleCourse, type Course } from "./types";
import { WAZIMU_OUTLINE } from "./wazimu";
import { mergeFeed } from "../account/merge";
import { coursePoints, dayPoints, activeDays } from "../feed/engine";
import type { FeedDB } from "../feed/store";
import { checkCourse, matchUpload } from "./studio";

const course: Course = {
  version: 1,
  id: "t",
  title: "Test",
  summary: "",
  credit: "© Kayani Herbs",
  passPercent: 70,
  modules: [
    { id: "m1", title: "One", lessons: [
      { id: "a", code: "1.0", title: "A", kind: "audio", mediaUrl: "a.m4a", seconds: 100, points: 10 },
      { id: "b", code: "1.1", title: "B", kind: "reading", bodySw: ["Soma"], points: 10 },
    ] },
    { id: "m2", title: "Two", lessons: [
      { id: "c", code: "2.0", title: "C (no audio yet)", kind: "audio", points: 10 },
      { id: "d", code: "2.1", title: "D", kind: "audio", mediaUrl: "d.m4a", seconds: 60, points: 10 },
      { id: "h", code: "2.2", title: "Hidden", kind: "audio", mediaUrl: "h.m4a", seconds: 60, points: 10, hidden: true },
    ] },
  ],
};
const at = "2026-10-16T08:00:00.000Z";

describe("listening rule", () => {
  it("needs 70% heard, and skipping ahead doesn't count", () => {
    expect(passSeconds(100, 70)).toBe(70);
    expect(passReached(69, 100, 70)).toBe(false);
    expect(passReached(70, 100, 70)).toBe(true);
    expect(passReached(500, undefined, 70)).toBe(false);
    expect(heardStep(10, 10.3)).toBeCloseTo(0.3);
    expect(heardStep(10, 11.2, 1.5)).toBeCloseTo(1.2);
    expect(heardStep(10, 80)).toBe(0); // dragged the slider
    expect(heardStep(80, 10)).toBe(0); // went back
  });
  it("shows clock times", () => {
    expect(clock(245)).toBe("4:05");
    expect(clock(3725)).toBe("1:02:05");
  });
});

describe("lessons open in order", () => {
  it("first lesson is current, the rest locked; hidden lessons never appear", () => {
    const v = courseView(visibleCourse(course), {});
    expect(v.lessons.map((l) => `${l.id}:${l.state}`)).toEqual(["a:current", "b:locked", "c:soon", "d:locked"]);
    expect(v.total).toBe(3);
    expect(v.current?.id).toBe("a");
  });
  it("finishing one opens the next; a lesson without audio doesn't block him", () => {
    const v = courseView(visibleCourse(course), {
      a: { pos: 90, heard: 80, at, done: { localDate: "2026-10-16", at, points: 10 } },
      b: { pos: 0, heard: 0, at, done: { localDate: "2026-10-16", at, points: 10 } },
    });
    expect(v.lessons.map((l) => `${l.id}:${l.state}`)).toEqual(["a:done", "b:done", "c:soon", "d:current"]);
    expect(v.percent).toBe(67);
    expect(v.modules).toEqual([{ id: "m1", done: 2, total: 2 }, { id: "m2", done: 0, total: 1 }]);
  });
  it("is finished when every ready lesson is done", () => {
    const done = { localDate: "2026-10-16", at, points: 10 };
    const v = courseView(visibleCourse(course), { a: { pos: 0, heard: 0, at, done }, b: { pos: 0, heard: 0, at, done }, d: { pos: 0, heard: 0, at, done } });
    expect(v.finished).toBe(true);
    expect(v.current).toBeNull();
  });
});

describe("course progress across phones", () => {
  const base: FeedDB = { days: {}, lessons: {}, settings: { discreet: false }, deleted: {} };
  it("newest spot wins, listening time only grows, the first finish counts", () => {
    const phoneA: FeedDB = { ...base, course: { a: { pos: 50, heard: 60, at: "2026-10-16T08:00:00Z" } } };
    const phoneB: FeedDB = { ...base, course: { a: { pos: 20, heard: 30, at: "2026-10-16T09:00:00Z", done: { localDate: "2026-10-16", at: "2026-10-16T09:00:00Z", points: 10 } } } };
    const m1 = mergeFeed(phoneA, phoneB);
    const m2 = mergeFeed(phoneB, phoneA);
    expect(m1.course).toEqual(m2.course);
    expect(m1.course?.a).toEqual({ pos: 20, heard: 60, at: "2026-10-16T09:00:00Z", done: { localDate: "2026-10-16", at: "2026-10-16T09:00:00Z", points: 10 } });
  });
  it("older saved data without courses still merges", () => {
    expect(mergeFeed(base, null).course).toEqual({});
  });
});

describe("course points", () => {
  it("count on the day he finished, and make it an active day", () => {
    const feed: FeedDB = { days: {}, lessons: {}, settings: { discreet: false }, course: { a: { pos: 0, heard: 0, at, done: { localDate: "2026-10-16", at, points: 10 } } } };
    expect(coursePoints(feed, "2026-10-16")).toBe(10);
    expect(dayPoints([], [], feed, [], [], "2026-10-16")).toBe(10);
    expect(activeDays(feed, [])).toEqual(["2026-10-16"]);
  });
});

describe("MTIE Wazimu Mkeo outline", () => {
  const all = flatLessons(WAZIMU_OUTLINE);
  it("has unique lesson ids and codes, and the Kayani credit", () => {
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length);
    expect(new Set(all.map((l) => l.code)).size).toBe(all.length);
    expect(WAZIMU_OUTLINE.credit).toMatch(/Kayani Herbs.*Mangi Masawe/);
  });
  it("keeps the risky lessons hidden, with a caution ready", () => {
    const hidden = all.filter((l) => l.hidden).map((l) => l.code);
    expect(hidden).toEqual(["3.3.1", "5.1", "6.6", "6.6.1", "6.7"]);
    for (const code of ["6.6", "6.6.1", "6.7"]) expect(all.find((l) => l.code === code)?.cautionSw).toBeTruthy();
  });
  it("passes the Studio's publishing checks once the audio is uploaded", () => {
    const withMedia: Course = {
      ...WAZIMU_OUTLINE,
      modules: WAZIMU_OUTLINE.modules.map((m) => ({ ...m, lessons: m.lessons.map((l) => (l.kind === "reading" ? l : { ...l, mediaUrl: `https://x/${l.code}.m4a` })) })),
    };
    expect(checkCourse(withMedia).filter((i) => i.level === "block")).toEqual([]);
    expect(checkCourse(WAZIMU_OUTLINE).some((i) => i.level === "block")).toBe(true); // no audio yet
    expect(lessonMinutes(all.find((l) => l.code === "2.1")!)).toBe(10);
  });
});

describe("matching uploaded files to lessons", () => {
  const lessons = flatLessons(WAZIMU_OUTLINE);
  it("uses the lesson number at the start of the file name", () => {
    expect(matchUpload("4.8.1 - Mikao mitamu 2.m4a", lessons)?.code).toBe("4.8.1");
    expect(matchUpload("4.8 - Mikao mitamu 1.m4a", lessons)?.code).toBe("4.8");
    expect(matchUpload("Lesson 2.0---1.2 Mindset ya Alpha Man.opus", lessons)?.code).toBe("2.0");
    expect(matchUpload("0.0 - Utangulizi.m4a", lessons)?.code).toBe("0.0");
    expect(matchUpload("random.m4a", lessons)).toBeNull();
  });
});
