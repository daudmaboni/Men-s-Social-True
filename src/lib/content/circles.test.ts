import { describe, expect, it } from "vitest";
import { CIRCLES, circleNames, circlesOf, setCircles } from "./circles";
import type { ContentItem } from "./types";

const item = (over: Partial<ContentItem> = {}) => ({ id: "x", kind: "reel", topic: "erection", title: "T", summary: "", minutes: 1, tags: [], body: [], ...over }) as unknown as ContentItem;

describe("Discover circles shared by the app and the Studio (Step 80)", () => {
  it("has the 7 circles men tap, in their order", () => {
    expect(CIRCLES.map((c) => c.label)).toEqual(["Last longer", "Stronger erections", "Satisfy her", "Natural mixes", "Exercises", "Quit porn", "Desire and round two"]);
  });

  it("cards use their action; reels and articles use their circle tags; older ones follow their topic", () => {
    expect(circlesOf({ ...item(), action: { challenges: ["her", "last"] } })).toEqual(["her", "last"]);
    expect(circlesOf(item({ tags: ["mixes", "garlic"] }))).toEqual(["mixes"]);
    expect(circlesOf(item({ topic: "ejaculation" }))).toEqual(["last"]);
    expect(circlesOf(item({ topic: "fertility" }))).toEqual([]);
  });

  it("picking circles in the Studio sets the tags and the topic behind the scenes, keeping other tags", () => {
    const a = setCircles(item({ tags: ["garlic", "hard"] }), ["her", "desire"]);
    expect(a.tags).toEqual(["garlic", "her", "desire"]);
    expect(a.topic).toBe("intimacy");
    expect(circleNames(a)).toBe("Satisfy her · Desire and round two");
  });

  it("content that fits no circle keeps fertility or sleep-and-body and shows under For you", () => {
    const b = setCircles(item({ tags: ["hard"] }), [], "fertility");
    expect(b.tags).toEqual([]);
    expect(b.topic).toBe("fertility");
    expect(circlesOf(b)).toEqual([]);
    expect(circleNames(b)).toBe("Fertility");
  });
});
