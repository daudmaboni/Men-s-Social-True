import { describe, expect, it } from "vitest";
import { project, releaseVelocity, rubberband, springAt } from "./spring";
import { landingTab } from "../tabGlide";

describe("springs (Step 76)", () => {
  it("starts exactly where the thing is and at the finger's speed", () => {
    const s = springAt(100, 400, 0, { velocity: 1500 });
    expect(s.value).toBeCloseTo(100);
    expect(s.velocity).toBeCloseTo(1500);
  });

  it("settles on the target without overshooting when damping is 1", () => {
    let max = -Infinity;
    for (let t = 0; t <= 1.5; t += 1 / 120) max = Math.max(max, springAt(0, 400, t, { damping: 1, response: 0.32, velocity: 3000 }).value);
    expect(max).toBeLessThanOrEqual(400.5);
    expect(springAt(0, 400, 1.5, { damping: 1, response: 0.32 }).value).toBeCloseTo(400, 0);
  });

  it("a tab glide is mostly there in about a fifth of a second", () => {
    const at = springAt(0, 390, 0.2, { damping: 1, response: 0.32 }).value;
    expect(at / 390).toBeGreaterThan(0.85);
  });

  it("overshoots a little when damping is below 1", () => {
    let max = -Infinity;
    for (let t = 0; t <= 1.5; t += 1 / 120) max = Math.max(max, springAt(0, 100, t, { damping: 0.8, response: 0.3 }).value);
    expect(max).toBeGreaterThan(100.5);
  });

  it("gives less and less past an edge", () => {
    expect(rubberband(0, 400)).toBe(0);
    expect(rubberband(100, 400)).toBeLessThan(100);
    expect(rubberband(400, 400) - rubberband(200, 400)).toBeLessThan(rubberband(200, 400));
    expect(rubberband(-100, 400)).toBeCloseTo(-rubberband(100, 400));
  });

  it("projects a flick forward and reads finger speed", () => {
    expect(project(1000)).toBeCloseTo(99);
    expect(project(-1000)).toBeCloseTo(-99);
    const now = 1000;
    expect(releaseVelocity([{ t: 950, x: 0 }, { t: 1000, x: 50 }], now)).toBeCloseTo(1000);
    expect(releaseVelocity([{ t: 800, x: 0 }, { t: 850, x: 50 }], now)).toBe(0); // he held still before letting go
  });
});

describe("tab landing uses the direction of the flick", () => {
  const base = { startTab: 1, width: 400, count: 3 };
  it("a long drag flicked back returns to where he started", () => {
    expect(landingTab({ ...base, dragPx: 230, velocity: -0.6 })).toBe(1);
    expect(landingTab({ ...base, dragPx: -230, velocity: 0.6 })).toBe(1);
  });
  it("a slow release carried on by its speed can pass halfway", () => {
    expect(landingTab({ ...base, dragPx: 180, velocity: 0.3 })).toBe(2);
    expect(landingTab({ ...base, dragPx: 180, velocity: 0 })).toBe(1);
  });
  it("never jumps two tabs", () => {
    expect(landingTab({ ...base, startTab: 0, dragPx: 700, velocity: 0.2 })).toBe(1);
  });
});
