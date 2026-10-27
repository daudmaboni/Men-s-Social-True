import { describe, expect, it } from "vitest";
import { addPart, cleanParts, heardPercent, heardSeconds, isListening, partsFromOld, skippedParts, unionParts, type HeardParts } from "./heard";
import { mergeFeed } from "../account/merge";

/** Play from `from` to `to`, reporting every `tick` seconds of audio at speed `rate`. */
function play(parts: HeardParts, from: number, to: number, tick = 0.25, rate = 1): HeardParts {
  let prev = from;
  for (let pos = from + tick; pos <= to + 1e-9; pos += tick) {
    if (isListening(prev, pos, tick / rate, rate)) parts = addPart(parts, prev, pos);
    prev = pos;
  }
  return parts;
}

describe("Step 98: heard parts", () => {
  it("replaying the same minute counts once", () => {
    let p: HeardParts = [];
    for (let i = 0; i < 3; i++) p = play(p, 0, 60);
    expect(heardSeconds(p)).toBeCloseTo(60, 0);
  });

  it("locked screen: a report every 10 seconds still counts", () => {
    const p = play([], 0, 300, 10);
    expect(heardSeconds(p)).toBeCloseTo(300, 0);
  });

  it("dragging the slider or ±15 doesn't count", () => {
    expect(isListening(10, 70, 0.25)).toBe(false); // slider
    expect(isListening(100, 115, 0.25)).toBe(false); // +15
    expect(isListening(100, 85, 0.25)).toBe(false); // back 15
    expect(isListening(10, 10.25, 0.25)).toBe(true);
  });

  it("2× speed: he covers the lesson twice as fast and it all counts", () => {
    const p = play([], 0, 120, 0.5, 2);
    expect(heardSeconds(p)).toBeCloseTo(120, 0);
  });

  it("the screenshot case: heard 0–3:10, jumped to 8:00 → 35%, and he's told about 3:10–8:00", () => {
    let p = play([], 0, 190);
    p = play(p, 480, 481);
    expect(heardPercent(p, 542)).toBe(35);
    expect(skippedParts(p, 481, 542)[0]).toEqual([190, 480]);
  });

  it("listening straight through shows no skipped part", () => {
    const p = play([], 0, 200);
    expect(skippedParts(p, 200, 542)).toEqual([]);
    expect(heardPercent(play(p, 200, 542), 542)).toBe(100);
  });

  it("old progress (seconds only) becomes heard-from-the-start", () => {
    expect(partsFromOld(95, undefined)).toEqual([[0, 95]]);
    expect(partsFromOld(95, [[0, 40]])).toEqual([[0, 40]]);
    expect(partsFromOld(0, undefined)).toEqual([]);
  });

  it("bad saved data is cleaned", () => {
    expect(cleanParts([[5, 2], ["a", 3], [0, 10], [9, 20]])).toEqual([[0, 20]]);
    expect(cleanParts("nope")).toEqual([]);
  });

  it("two phones: everything heard on either counts", () => {
    expect(unionParts([[0, 60]], [[120, 180]])).toEqual([[0, 60], [120, 180]]);
    const local = { version: 1, days: {}, lessons: {}, course: { a: { pos: 60, heard: 60, parts: [[0, 60]] as HeardParts, at: "2026-10-27T10:00:00Z" } } };
    const remote = { course: { a: { pos: 180, heard: 60, parts: [[120, 180]] as HeardParts, at: "2026-10-27T11:00:00Z" } } };
    const merged = mergeFeed(local as never, remote as never);
    expect(merged.course?.a.parts).toEqual([[0, 60], [120, 180]]);
    expect(merged.course?.a.heard).toBe(120);
    expect(merged.course?.a.pos).toBe(180);
  });
});
