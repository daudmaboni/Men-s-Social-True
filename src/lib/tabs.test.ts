import { describe, expect, it } from "vitest";
import { isTabRoot, stripPosition, tabFor } from "./tabs";

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
  it("shares the strip position with the tab bar", () => {
    const seen: number[] = [];
    const off = stripPosition.subscribe((p) => {
      seen.push(p);
    });
    stripPosition.set(1.5);
    off();
    stripPosition.set(2);
    expect(seen).toEqual([1.5]);
    expect(stripPosition.get()).toBe(2);
  });
});
