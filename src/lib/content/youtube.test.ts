import { describe, expect, it } from "vitest";
import { cleanYouTubeUrl, embedUrl, isYouTubeShort, youtubeId } from "./youtube";

describe("YouTube links", () => {
  it("finds the video id in every kind of link", () => {
    const id = "dQw4w9WgXcQ";
    for (const url of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtube.com/watch?v=${id}&t=30s`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}?si=abc`,
      `https://www.youtube.com/shorts/${id}`,
      `https://youtube.com/shorts/${id}?feature=share`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/live/${id}`,
    ])
      expect(youtubeId(url), url).toBe(id);
  });
  it("ignores other links", () => {
    for (const url of ["https://example.com/v.mp4", "https://youtube.com/@kayani", "https://youtu.be/short", "not a link", "", null]) expect(youtubeId(url)).toBeNull();
  });
  it("keeps Shorts as Shorts", () => {
    expect(isYouTubeShort("https://youtube.com/shorts/dQw4w9WgXcQ?si=x")).toBe(true);
    expect(isYouTubeShort("https://youtu.be/dQw4w9WgXcQ")).toBe(false);
    expect(cleanYouTubeUrl("https://youtube.com/shorts/dQw4w9WgXcQ?si=x")).toBe("https://www.youtube.com/shorts/dQw4w9WgXcQ");
    expect(cleanYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?si=x")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });
  it("embeds silently, without tracking cookies, looping only when asked", () => {
    const u = new URL(embedUrl("dQw4w9WgXcQ", { loop: true }));
    expect(u.hostname).toBe("www.youtube-nocookie.com");
    expect(u.searchParams.get("mute")).toBe("1");
    expect(u.searchParams.get("playlist")).toBe("dQw4w9WgXcQ");
    expect(new URL(embedUrl("dQw4w9WgXcQ")).searchParams.get("loop")).toBeNull();
  });
});
