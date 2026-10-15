import { describe, expect, it } from "vitest";
import { landingTab } from "./tabGlide";

const base = { startTab: 1, width: 400, count: 3 };

describe("where a tab swipe lands", () => {
  it("a quick flick changes tab even when short", () => {
    expect(landingTab({ ...base, dragPx: 60, velocity: 0.8 })).toBe(2);
    expect(landingTab({ ...base, dragPx: -60, velocity: -0.8 })).toBe(0);
  });
  it("a slow drag must pass halfway, otherwise it springs back", () => {
    expect(landingTab({ ...base, dragPx: 150, velocity: 0.1 })).toBe(1);
    expect(landingTab({ ...base, dragPx: 230, velocity: 0.1 })).toBe(2);
  });
  it("never goes past the first or last tab", () => {
    expect(landingTab({ ...base, startTab: 2, dragPx: 300, velocity: 1 })).toBe(2);
    expect(landingTab({ ...base, startTab: 0, dragPx: -300, velocity: -1 })).toBe(0);
  });
});
