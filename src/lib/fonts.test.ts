import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FONTS, TEXT_SIZES, fontKey, scopeOfPath, sizeKey } from "./fonts";
import { THEME_BOOT_SCRIPT } from "./themeBoot";

const css = readFileSync(join(process.cwd(), "src/app/fonts.css"), "utf8");

describe("font styles and text size (Step 66)", () => {
  it("every font has its file and its rule, so choosing it never falls back silently", () => {
    for (const f of FONTS) {
      if (f.kind === "brand") continue;
      expect(css, f.id).toContain(`html[data-font="${f.id}"]`);
      if (f.kind === "system") continue;
      expect(existsSync(join(process.cwd(), "public/fonts", `${f.id}.woff2`)), f.id).toBe(true);
      expect(css, f.id).toContain(`url("/fonts/${f.id}.woff2")`);
    }
  });
  it("every text size except Normal has a rule", () => {
    for (const z of TEXT_SIZES) if (z.id !== "md") expect(css).toContain(`html[data-size="${z.id}"] { font-size: ${z.percent}%; }`);
  });
  it("the Studio keeps its own choice, separate from the men's app", () => {
    expect(scopeOfPath("/studio/users")).toBe("studio");
    expect(scopeOfPath("/social")).toBe("app");
    expect(fontKey("studio")).not.toBe(fontKey("app"));
    for (const k of [fontKey("app"), fontKey("studio"), sizeKey("app"), sizeKey("studio")]) expect(THEME_BOOT_SCRIPT).toContain(k);
  });
  it("the font ids fit what the start-up script accepts", () => {
    for (const f of FONTS) expect(f.id).toMatch(/^[a-z0-9-]{2,30}$/);
  });
});
