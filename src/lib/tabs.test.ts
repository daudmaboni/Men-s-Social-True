import { describe, expect, it } from "vitest";
import { bubbleShape, isTabRoot, tabFor } from "./tabs";

describe("tabs", () => {
  it("knows which tab a page belongs to", () => {
    expect(tabFor("/social/c/abc")).toBe(0);
    expect(tabFor("/learn/x")).toBe(1);
    expect(tabFor("/account")).toBe(2);
    expect(tabFor("/studio")).toBe(-1);
  });
  it("only the main page of each tab sits in the sliding strip", () => {
    expect(isTabRoot("/man")).toBe(true);
    expect(isTabRoot("/social/c/abc")).toBe(false);
  });
  it("the bubble is round on a tab and stretches most halfway between tabs", () => {
    expect(bubbleShape(1)).toEqual({ x: 1, stretch: 1 });
    expect(bubbleShape(0.5).stretch).toBeCloseTo(1.22);
    expect(bubbleShape(0.25).stretch).toBeLessThan(bubbleShape(0.5).stretch);
    expect(bubbleShape(-0.3).x).toBe(0); // stays on the bar when pulled past the ends
    expect(bubbleShape(2.4).x).toBe(2);
  });
});
