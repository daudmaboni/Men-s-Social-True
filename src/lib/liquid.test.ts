import { describe, expect, it } from "vitest";
import { isSettled, shapeFor, stepSpring, type SpringState } from "./liquid";

function run(from: SpringState, target: number, seconds: number) {
  let s = from;
  const path: number[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    s = stepSpring(s, target, 1 / 60);
    path.push(s.x);
  }
  return { s, path };
}

describe("liquid glass spring", () => {
  it("reaches the new tab and settles in under a second", () => {
    const { s } = run({ x: 0, v: 0 }, 1, 0.75);
    expect(isSettled(s, 1)).toBe(true);
  });
  it("overshoots only a little (soft, not bouncy)", () => {
    const { path } = run({ x: 0, v: 0 }, 1, 1);
    const peak = Math.max(...path);
    expect(peak).toBeGreaterThan(1.005); // there is an overshoot
    expect(peak).toBeLessThan(1.08); // but it's small
  });
  it("handles quick taps: changing target mid-way keeps moving smoothly (no jump back)", () => {
    const first = run({ x: 0, v: 0 }, 2, 0.08).s; // heading to Me
    const next = stepSpring(first, 1, 1 / 60); // tapped Man instead
    expect(next.x).toBeGreaterThanOrEqual(first.x); // momentum carries on, no reset to the start
    expect(next.x - first.x).toBeLessThan(0.25); // one frame = a small, continuous step
    expect(isSettled(run(next, 1, 0.8).s, 1)).toBe(true);
  });
  it("stays stable when the phone skips frames", () => {
    const s = stepSpring({ x: 0, v: 0 }, 1, 0.5);
    expect(Number.isFinite(s.x)).toBe(true);
    expect(s.x).toBeLessThan(1.2);
  });
});

describe("glass shape", () => {
  it("is round at rest", () => {
    expect(shapeFor(0)).toEqual({ scaleX: 1, scaleY: 1, origin: "center", lean: 0 });
  });
  it("stretches while moving, keeps the back edge and reaches forward", () => {
    const right = shapeFor(4);
    expect(right.scaleX).toBeGreaterThan(1.15);
    expect(right.scaleY).toBeLessThan(1);
    expect(right.origin).toBe("left");
    expect(shapeFor(-4).origin).toBe("right");
  });
  it("never stretches too far, even when flung", () => {
    expect(shapeFor(100).scaleX).toBeLessThanOrEqual(1.3);
  });
});
