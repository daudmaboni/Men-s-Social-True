import { describe, expect, it } from "vitest";
import { pickPlaying } from "./feedPlayer";

const m = (o: Record<string, number>) => new Map(Object.entries(o));

describe("only one reel plays in the feed (Step 73)", () => {
  it("plays the reel most on screen", () => {
    expect(pickPlaying(m({ a: 0.7, b: 0.95 }), null, false)).toBe("b");
  });
  it("needs at least 60% on screen", () => {
    expect(pickPlaying(m({ a: 0.4, b: 0.59 }), null, false)).toBeNull();
  });
  it("on a tie the one already playing keeps going", () => {
    expect(pickPlaying(m({ a: 1, b: 1 }), "b", false)).toBe("b");
    expect(pickPlaying(m({ a: 1, b: 1 }), "a", false)).toBe("a");
  });
  it("nothing plays while the full-screen viewer is open or the app is hidden", () => {
    expect(pickPlaying(m({ a: 1 }), "a", true)).toBeNull();
  });
});
