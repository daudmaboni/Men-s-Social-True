import { describe, expect, it } from "vitest";
import { LIBRARY } from "./library";
import { orderSections, pickFeatured, searchContent, sectionAll, sectionItems, SECTIONS } from "./select";
import type { ContentItem } from "./types";

describe("content library", () => {
  it("has unique ids and every item is marked as a sample draft", () => {
    const ids = LIBRARY.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(LIBRARY.every((c) => c.fixture && c.review === "draft" && c.source.length > 0)).toBe(true);
  });
  it("never promises cures or guaranteed results", () => {
    const text = JSON.stringify(LIBRARY).toLowerCase();
    for (const banned of ["guaranteed to", "guarantees", "100%", "will cure", "cures erectile", "permanent cure", "miracle"]) {
      expect(text.includes(banned), banned).toBe(false);
    }
  });
  it("quizzes have valid answers and tools have a tool id", () => {
    for (const c of LIBRARY) {
      if (c.kind === "quiz") c.quiz!.forEach((q) => expect(q.answer).toBeLessThan(q.options.length));
      if (c.kind === "tool") expect(c.tool).toBeTruthy();
    }
  });
  it("fills all nine Discover sections", () => {
    expect(SECTIONS).toHaveLength(9);
    for (const s of SECTIONS) expect(sectionItems(s.id).length, s.id).toBeGreaterThan(0);
  });
});

describe("featured content", () => {
  it("picks the highest editorial priority when he has no interests", () => {
    expect(pickFeatured([])?.id).toBe("erection-guide");
  });
  it("favours a topic he chose", () => {
    expect(pickFeatured(["intimacy"])?.topic).toBe("intimacy");
    expect(pickFeatured(["ejaculation"])?.id).toBe("lasting-longer");
  });
  it("only features reading content (guides and articles)", () => {
    expect(["guide", "article"]).toContain(pickFeatured(["libido"])?.kind);
  });
  it("returns null when there is no content", () => {
    expect(pickFeatured([], [])).toBeNull();
  });
  it("does not repeat the featured item in its section row", () => {
    expect(sectionItems("erection", "erection-guide").some((c) => c.id === "erection-guide")).toBe(false);
  });
});

describe("sections and search", () => {
  it("topic pages include every format for that topic", () => {
    const kinds = new Set(sectionAll("erection").map((c) => c.kind));
    expect(kinds.has("quiz") && kinds.has("tool") && kinds.has("expert")).toBe(true);
  });
  it("puts his chosen topics first", () => {
    expect(orderSections(["intimacy"])[0].id).toBe("intimacy");
  });
  it("finds content by words in titles, tags and text", () => {
    expect(searchContent("pelvic floor").map((c) => c.id)).toContain("tool-pelvic-floor");
    expect(searchContent("fertility")[0].id).toBe("fertility-basics");
    expect(searchContent("TMDA").map((c) => c.id)).toContain("expert-instant-boosters");
  });
  it("needs every word to match, and ignores empty searches", () => {
    expect(searchContent("pelvic zzzz")).toEqual([]);
    expect(searchContent("  ")).toEqual([]);
  });
  it("works on any list (e.g. a future database result)", () => {
    const one = [{ ...LIBRARY[0], id: "x", title: "Hello world" } as ContentItem];
    expect(searchContent("hello", one)).toHaveLength(1);
  });
});
