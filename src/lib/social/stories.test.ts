import { describe, expect, it } from "vitest";
import { helpedShown, rowToStory, storyFor } from "./stories";

describe("stories", () => {
  const a = rowToStory({ id: "a", text_en: "It worked", text_sw: null, who_en: null, who_sw: "Mwanaume, 34", circle: "last", published_at: "2026-10-01" })!;
  const b = rowToStory({ id: "b", text_en: "Sleep fixed it", text_sw: "Usingizi", who_en: "A man, 40", who_sw: null, circle: "nope", published_at: "2026-10-02" })!;
  it("fills the other language and never needs a name", () => {
    expect(a.textSw).toBe("It worked");
    expect(a.who).toBe("Mwanaume, 34");
    expect(b.circle).toBeNull();
    expect(rowToStory({ id: "c", text_en: " ", text_sw: null, who_en: null, who_sw: null, circle: null, published_at: null })).toBeNull();
  });
  it("prefers stories from the circle he's in", () => {
    expect(storyFor([b, a], 0, "last", 0)?.id).toBe("a");
    expect(storyFor([b, a], 1, null, 0)?.id).toBe("a");
    expect(storyFor([], 0, null, 0)).toBeNull();
  });
  it("shows a helped count only from the Studio's minimum", () => {
    expect(helpedShown(4, false, 5)).toBeNull();
    expect(helpedShown(5, false, 5)).toBe(5);
    expect(helpedShown(0, true, 1)).toBe(1);
    expect(helpedShown(50, true, 0)).toBeNull();
  });
});
