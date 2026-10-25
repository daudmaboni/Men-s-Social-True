// Step 96: Apple design pass. Guards the accessibility fixes so they don't quietly come undone.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TEXT_SIZES } from "../fonts";
import { THEME_BOOT_SCRIPT } from "../themeBoot";

const src = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("Step 96: Apple design pass", () => {
  it("text can grow to at least 200% (Apple: Accessibility › Support larger text sizes)", () => {
    expect(Math.max(...TEXT_SIZES.map((z) => z.percent))).toBeGreaterThanOrEqual(200);
  });

  it("the boot script keeps every bigger size on reload", () => {
    for (const z of TEXT_SIZES) if (z.id !== "md") expect(THEME_BOOT_SCRIPT).toContain(z.id);
  });

  it("the English offer card slides in and stays (float-up ends invisible and untappable)", () => {
    const offer = src("components/social/ContentLangOffer.tsx");
    expect(offer).not.toMatch(/className="float-up/);
  });

  it("every pop-up moves focus inside and back", () => {
    for (const f of [
      "components/motion/Sheet.tsx",
      "components/admin/ui.tsx",
      "components/admin/SwipeDrawer.tsx",
      "components/admin/AccountMenu.tsx",
      "components/social/Reels.tsx",
      "components/kito/KitoLauncher.tsx",
      "components/me/LanguageGate.tsx",
    ])
      expect(src(f), f).toContain("useDialogFocus(");
  });

  it("no text in the phone app is smaller than 11px", () => {
    for (const f of ["components/progress/CheckInCard.tsx", "components/progress/HydrationCard.tsx", "components/progress/SleepCard.tsx", "components/me/ProfileHero.tsx"])
      expect(src(f), f).not.toMatch(/text-\[0\.(5625|625)rem\]/);
  });
});
