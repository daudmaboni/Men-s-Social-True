import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Step 97: the squint test. Blur a screen; what stands out first should be what a man
// should act on first. These guards stop the loud versions from quietly coming back.
const root = join(__dirname, "..", "..", "components");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("Step 97 squint test", () => {
  it("Discover card tags don't use honey (honey is for the +points on 'I did it')", () => {
    const src = read("social/ActionFeed.tsx");
    const tag = src.slice(src.indexOf("RESULT_LABEL[spec.results]") - 400, src.indexOf("RESULT_LABEL[spec.results]"));
    expect(tag).not.toContain("bg-honey");
  });

  it("activity rows use a soft Done, so the Now card's solid Done leads", () => {
    const src = read("feed/ActivitiesCard.tsx");
    expect(src).toContain("tap-target rounded-full bg-mint px-3.5 py-1.5 text-xs font-semibold text-forest");
  });

  it("the new-man intro card is light, not the dark hero", () => {
    const src = read("feed/FeedCards.tsx");
    const intro = src.slice(src.indexOf("if (f.isNew)"), src.indexOf("if (f.isNew)") + 400);
    expect(intro).toContain("bg-mint/50");
    expect(intro).not.toContain("bg-forest-deep");
  });
});
