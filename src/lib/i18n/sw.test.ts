// Every piece of English text on the men's screens must have a Kiswahili version,
// so switching language changes the whole app, not just the first page.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SW } from "./sw";
import { makeT, translate } from "./translate";

const ROOT = join(process.cwd(), "src");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return /studio|i18n/.test(p) ? [] : files(p); // the Studio is staff-only, in English
    return /\.(tsx?|ts)$/.test(p) && !/\.test\.ts$/.test(p) ? [p] : [];
  });
}
const unescape = (s: string) => s.replace(/\\(["'`\\])/g, "$1");

/** t("…") / tr("…") / translate(lang, "…") with a fixed string, and text fields of lists on translated screens. */
function wanted(): Map<string, string> {
  const found = new Map<string, string>();
  for (const f of files(ROOT)) {
    const src = readFileSync(f, "utf8");
    if (!/\b(useT|translate)\b/.test(src)) continue;
    const short = f.slice(ROOT.length + 1);
    const call = /\b(?:t|tr)\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;
    for (const m of src.matchAll(call)) found.set(unescape(m[1] ?? m[2]), short);
    const tern = /\b(?:t|tr)\(\s*[^()"']*?\?\s*"((?:[^"\\]|\\.)*)"\s*:\s*(?:[^()"']*?\?\s*"((?:[^"\\]|\\.)*)"\s*:\s*)?"((?:[^"\\]|\\.)*)"/g;
    for (const m of src.matchAll(tern)) [m[1], m[2], m[3]].filter(Boolean).forEach((s) => found.set(unescape(s), short));
    const field = /\b(?:label|title|text|ask|how|about|detail|why|discreetTitle|q|short|blurb)\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    for (const m of src.matchAll(field)) found.set(unescape(m[1]), short);
    const tr = /translate\(\s*[^,]+,\s*"((?:[^"\\]|\\.)*)"/g;
    for (const m of src.matchAll(tr)) found.set(unescape(m[1]), short);
  }
  return found;
}

describe("Kiswahili translations", () => {
  it("cover every text on the men's screens", () => {
    const missing = [...wanted()].filter(([en]) => en.trim() && /[a-z]/i.test(en) && !(en in SW)).map(([en, f]) => `${f}: ${en}`);
    expect(missing).toEqual([]);
  });

  it("keep the {placeholders}", () => {
    const broken = Object.entries(SW).filter(([en, sw]) => {
      const a = (en.match(/\{\w+\}/g) ?? []).sort().join();
      const b = (sw.match(/\{\w+\}/g) ?? []).sort().join();
      return a !== b;
    });
    expect(broken).toEqual([]);
  });

  it("fill in values and fall back to English", () => {
    expect(translate("sw", "+{n} points", { n: 15 })).toBe("+15 pointi");
    expect(translate("en", "+{n} points", { n: 15 })).toBe("+15 points");
    expect(translate("sw", "A sentence nobody translated")).toBe("A sentence nobody translated");
    expect(makeT("sw").locale).toBe("sw-TZ");
  });

  it("cover the data lists shown on screen", async () => {
    const { ACTIVITIES, TIPS } = await import("../feed/catalog");
    const { TOPICS } = await import("../content/library");
    const { SECTIONS, KIND_LABEL, CTA_LABEL } = await import("../content/select");
    const { COMMUNITY_TOPICS, REACTIONS, REPORT_REASONS } = await import("../social/community");
    const { RATING_LABELS } = await import("../progress/format");
    const { REGIONS } = await import("../me/profile");
    const texts = [
      ...ACTIVITIES.flatMap((a) => [a.title, a.discreetTitle, a.detail, a.why]),
      ...TIPS,
      ...TOPICS.flatMap((t) => [t.title, t.short]),
      ...SECTIONS.flatMap((s) => [s.title, s.blurb]).filter(Boolean),
      ...Object.values(KIND_LABEL),
      ...Object.values(CTA_LABEL),
      ...COMMUNITY_TOPICS.map((t) => t.label),
      ...REACTIONS.map((r) => r.label),
      ...REPORT_REASONS,
      ...RATING_LABELS,
      "Outside Tanzania",
      "Good morning", "Good afternoon", "Good evening", "morning", "afternoon", "evening",
    ];
    expect(REGIONS).toContain("Outside Tanzania");
    expect(texts.filter((x) => !(x in SW))).toEqual([]);
  });
});
