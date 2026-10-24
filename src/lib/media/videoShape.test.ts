import { describe, expect, it } from "vitest";
import { UPRIGHT, WIDE, ratioFrom, rememberShape, shapeKey, shapeOf } from "./videoShape";

describe("video shape (Step 92)", () => {
  it("reads wide and upright videos the right way round", () => {
    expect(ratioFrom(1920, 1080)).toBeCloseTo(16 / 9, 2);
    expect(ratioFrom(1080, 1920)).toBeCloseTo(9 / 16, 2);
    expect(ratioFrom(0, 0)).toBeNull();
  });

  it("uses the fallback until the video has loaded, then its real shape", () => {
    const url = "https://x.supabase.co/storage/v1/object/public/media/wide.mp4";
    expect(shapeOf(url, UPRIGHT)).toBe(UPRIGHT);
    rememberShape(url, 1280, 720);
    expect(shapeOf(url, UPRIGHT)).toBeCloseTo(16 / 9, 2);
    expect(shapeOf(`${url}#t=0.5`, UPRIGHT)).toBeCloseTo(16 / 9, 2);
    expect(shapeKey(`${url}#t=0.5`)).toBe(url);
  });

  it("knows YouTube Shorts are upright and other YouTube videos wide", () => {
    expect(shapeOf("https://www.youtube.com/shorts/abcdefghijk", WIDE)).toBe(UPRIGHT);
    expect(shapeOf("https://www.youtube.com/watch?v=abcdefghijk", UPRIGHT)).toBe(WIDE);
  });
});
