import { describe, expect, it } from "vitest";
import { isLate, isReel, reelOrder, softEndIndex } from "./reels";
import type { ContentItem } from "./types";

const base: Omit<ContentItem, "id" | "kind" | "title"> = { topic: "wellbeing", summary: "", minutes: 1, priority: 50, tags: [], source: "Kayani Herbs", review: "draft", fixture: false, cover: { tone: "forest", motif: "rings" } };
const reel = (id: string, publishedAt: string, extra: Partial<ContentItem> = {}): ContentItem => ({ ...base, id, kind: "reel", title: id, videoUrl: `https://x.co/${id}.mp4`, publishedAt, ...extra });

describe("Reels (Step 70)", () => {
  it("only videos count as reels", () => {
    expect(isReel(reel("a", "2026-10-01"))).toBe(true);
    expect(isReel(reel("b", "2026-10-01", { videoUrl: undefined }))).toBe(false);
    expect(isReel({ ...reel("c", "2026-10-01"), kind: "guide" })).toBe(false);
    expect(isReel(reel("d", "2026-10-01", { status: "archived" }))).toBe(false);
  });
  it("new reels first (newest first), watched ones at the end", () => {
    const list = [reel("old", "2026-10-01"), reel("new", "2026-10-20"), reel("seen", "2026-10-21")];
    expect(reelOrder(list, { seen: "2026-10-21T10:00:00Z" }).map((r) => r.id)).toEqual(["new", "old", "seen"]);
  });
  it("the soft end comes after 15 reels in the day and after 3 late at night", () => {
    const day = new Date("2026-10-22T14:00:00");
    const night = new Date("2026-10-22T23:00:00");
    expect(isLate(night)).toBe(true);
    expect(softEndIndex(0, 40, day)).toBe(15);
    expect(softEndIndex(5, 40, night)).toBe(8);
    expect(softEndIndex(0, 10, day)).toBe(-1); // he reaches the real end first
  });
});

import { reelCaption } from "./reels";
describe("reelCaption", () => {
  it("doesn't repeat the title", () => {
    expect(reelCaption({ title: "Mix ya tangawizi", summary: "Mix ya tangawizi\nKunywa asubuhi" }, false)).toBe("Kunywa asubuhi");
    expect(reelCaption({ title: "Mix ya tangawizi", summary: "Mix ya tangawizi" }, false)).toBe("");
    expect(reelCaption({ title: "A", summary: "Other text", summarySw: "Maneno", titleSw: "B" }, true)).toBe("Maneno");
  });
});
