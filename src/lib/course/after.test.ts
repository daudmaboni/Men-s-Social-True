import { describe, expect, it } from "vitest";
import { lessonAfter } from "./types";

// Step 49: which lessons roll on to the next one by themselves, and which wait for him
describe("lessonAfter", () => {
  it("plays straight on after a normal audio lesson", () => {
    expect(lessonAfter({ id: "wz-2-0", kind: "audio" })).toEqual({ mode: "auto" });
  });
  it("waits after the question lesson, with something to do first", () => {
    const a = lessonAfter({ id: "wz-1-1", kind: "audio" });
    expect(a.mode).toBe("wait");
    expect(a.task).toMatch(/answers/);
    expect(a.taskSw).toMatch(/majibu/);
  });
  it("waits after exercises and after reading", () => {
    expect(lessonAfter({ id: "wz-6-2", kind: "audio" }).mode).toBe("wait");
    expect(lessonAfter({ id: "x", kind: "reading" }).mode).toBe("wait");
  });
  it("lets the Studio choice win, including its own task", () => {
    expect(lessonAfter({ id: "wz-1-1", kind: "audio", after: "auto" })).toEqual({ mode: "auto" });
    const w = lessonAfter({ id: "x", kind: "audio", after: "wait", task: "Do it", taskSw: "Fanya" });
    expect(w).toEqual({ mode: "wait", task: "Do it", taskSw: "Fanya" });
  });
});
