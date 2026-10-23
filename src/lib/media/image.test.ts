import { describe, expect, it } from "vitest";
import { imgProps, resizable, sized } from "./image";

const SB = "https://oovvbluaiytosfmwpfbj.supabase.co/storage/v1/object/public/content-images/cards/beetroot-juice.jpg";

describe("lighter photos (Step 85)", () => {
  it("only our own photos and our Supabase storage are resized", () => {
    expect(resizable(SB)).toBe(true);
    expect(resizable("/brand/icon-192.png")).toBe(true);
    expect(resizable("https://i.ytimg.com/vi/abc/hqdefault.jpg")).toBe(false);
    expect(resizable("https://evil.example.com/x.jpg")).toBe(false);
  });
  it("asks Netlify for a phone-sized copy on the live site, and leaves the photo alone elsewhere", () => {
    expect(sized(SB, 720, 70, true)).toBe(`/.netlify/images?url=${encodeURIComponent(SB)}&w=720&q=70`);
    expect(sized(SB, 720, 70, false)).toBe(SB);
  });
  it("offers a set of widths for the phone to pick from; fewer and smaller with Data Saver", () => {
    const full = imgProps(SB, { on: true });
    expect(full.srcSet?.split(", ")).toHaveLength(4);
    expect(full.sizes).toContain("100vw");
    const low = imgProps(SB, { on: true, low: true });
    expect(low.srcSet).not.toContain("w=1080");
    expect(low.srcSet).toContain("q=50");
    expect(imgProps(SB, { on: false })).toEqual({ src: SB });
    expect(imgProps(undefined, { on: true })).toEqual({ src: undefined });
  });
});
