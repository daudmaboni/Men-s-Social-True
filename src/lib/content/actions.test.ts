import { describe, expect, it } from "vitest";
import { ACTION_CONTENT, actionOf } from "./actions";
import { checkClaims } from "../studio/claims";

describe("\"do this\" cards", () => {
  it("are all actions: steps in English and Kiswahili, a challenge and a timing", () => {
    expect(ACTION_CONTENT.length).toBeGreaterThanOrEqual(40);
    for (const c of ACTION_CONTENT) {
      const a = c.action!;
      expect(a.steps.length, c.id).toBeGreaterThanOrEqual(3);
      for (const s of a.steps) {
        expect(s.text && s.textSw, c.id).toBeTruthy();
        expect(Boolean(s.title), c.id).toBe(Boolean(s.titleSw));
      }
      expect(a.challenges.length, c.id).toBeGreaterThan(0);
      expect(a.need?.length ?? 0, c.id).toBe(a.needSw?.length ?? 0);
      expect(Boolean(a.why), c.id).toBe(Boolean(a.whySw));
      expect(c.titleSw && c.summarySw, c.id).toBeTruthy();
      expect(c.bodySw?.length, c.id).toBe(c.body?.length);
    }
  });

  it("start with a verb or a clear instruction, not \"What is…\"", () => {
    for (const c of ACTION_CONTENT) expect(c.title, c.id).not.toMatch(/^(what|why) (is|are)\b/i);
  });

  it("never carry prices, phone numbers, ordering or cure promises", () => {
    for (const c of ACTION_CONTENT) {
      const blocks = checkClaims(c).filter((i) => i.level === "block");
      expect(blocks, c.id).toEqual([]);
    }
  });

  it("keep their steps when staff edit the words in the Studio", () => {
    const first = ACTION_CONTENT[0];
    expect(actionOf({ id: first.id })).toEqual(first.action);
    expect(actionOf({ id: "not-an-action" })).toBeUndefined();
  });
});
