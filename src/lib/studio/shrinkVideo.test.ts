import { describe, expect, it } from "vitest";
import { maxSeconds, MIN_VIDEO_BPS, pickRecorderType, planShrink, TARGET_BYTES } from "./shrinkVideo";

describe("shrinking big videos", () => {
  it("makes an upright phone video 720 wide and keeps a sharp bitrate for a short reel", () => {
    const p = planShrink(60, 1080, 1920)!;
    expect([p.width, p.height]).toEqual([720, 1280]);
    expect(p.videoBps).toBe(2_500_000);
    // 60 s at that rate fits easily
    expect(((p.videoBps + p.audioBps) * 60) / 8).toBeLessThan(TARGET_BYTES);
  });
  it("lowers the bitrate for longer videos so they still fit", () => {
    const p = planShrink(240, 1920, 1080)!;
    expect([p.width, p.height]).toEqual([1280, 720]);
    expect(((p.videoBps + p.audioBps) * 240) / 8).toBeLessThan(TARGET_BYTES);
    expect(p.videoBps).toBeGreaterThanOrEqual(MIN_VIDEO_BPS);
  });
  it("doesn't make small videos bigger, and keeps sizes even", () => {
    const p = planShrink(30, 541, 961)!;
    expect([p.width, p.height]).toEqual([542, 962]);
  });
  it("says no when the video is too long to fit", () => {
    expect(planShrink(maxSeconds() + 120, 1080, 1920)).toBeNull();
    expect(planShrink(0, 1080, 1920)).toBeNull();
  });
  it("the second try uses a lower bitrate", () => {
    expect(planShrink(60, 1080, 1920, 0.6)!.videoBps).toBe(1_500_000);
  });
  it("prefers MP4, falls back to WebM", () => {
    expect(pickRecorderType((t) => t.startsWith("video/mp4"))).toMatch(/^video\/mp4/);
    expect(pickRecorderType((t) => t.startsWith("video/webm"))).toMatch(/^video\/webm/);
    expect(pickRecorderType(() => false)).toBeNull();
  });
});
