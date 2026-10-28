import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Step 99: corner concentricity. A shape tucked in the corner of a rounded card uses
// `concentric` (card radius minus the gap) instead of its own made-up radius.
const src = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(src, p), "utf8");

// Mirrors the CSS rule in globals.css
const radius = (outer: number, pad: number, min = 8) => Math.max(min, outer - pad);

describe("Step 99 corner concentricity", () => {
  it("the CSS rule is outer radius minus the gap, never below the minimum", () => {
    const css = read("app/globals.css");
    expect(css).toContain("max(var(--nest-min, 8px), calc(var(--nest-r, 24px) - var(--nest-p, 20px)))");
    expect(radius(28, 20)).toBe(8); // profile hero tiles
    expect(radius(24, 20)).toBe(8); // usual card, floored
    expect(radius(16, 10, 6)).toBe(6); // mini player art
  });

  it.each([
    ["components/me/ProfileHero.tsx", 2],
    ["components/me/BadgesSection.tsx", 1],
    ["components/me/SettingsSections.tsx", 3],
    ["components/progress/CheckInCard.tsx", 1],
    ["components/progress/HydrationCard.tsx", 1],
    ["components/progress/SleepCard.tsx", 1],
    ["components/feed/TrendsSection.tsx", 1],
    ["components/course/CourseCard.tsx", 1],
    ["components/course/MiniPlayer.tsx", 1],
    ["app/page.tsx", 1],
  ])("%s keeps its corner shapes concentric", (file, n) => {
    expect(read(file).match(/\bconcentric\b/g)?.length ?? 0).toBeGreaterThanOrEqual(n);
  });

  it("cards with a non-standard radius or gap say so", () => {
    expect(read("components/me/ProfileHero.tsx")).toContain("[--nest-r:28px]");
    expect(read("components/course/MiniPlayer.tsx")).toContain("[--nest-r:16px] [--nest-p:10px] [--nest-min:6px]");
  });
});
