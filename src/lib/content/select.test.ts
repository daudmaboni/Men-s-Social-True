import { describe, expect, it } from "vitest";
import { LIBRARY } from "./library";
import { featuredToday, OPTIONAL_SECTIONS, orderSections, pickFeatured, questionToday, quickVideos, recommendations, searchContent, sectionAll, sectionItems, SECTIONS, topicTiles, type Personal } from "./select";
import type { ContentItem } from "./types";

describe("content library", () => {
  it("has unique ids, and every item shows its source and draft status", () => {
    const ids = LIBRARY.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(LIBRARY.every((c) => c.review === "draft" && c.source.length > 0)).toBe(true);
  });
  it("real (non-sample) items link back to where they came from, with a Kiswahili version", () => {
    for (const c of LIBRARY.filter((x) => !x.fixture)) {
      expect(c.origin?.url, c.id).toMatch(/^https:\/\/www\.instagram\.com\//);
      expect(c.bodySw?.length, c.id).toBe(c.body?.length);
      expect(c.titleSw, c.id).toBeTruthy();
    }
  });
  it("never promises cures or guaranteed results", () => {
    const text = JSON.stringify(LIBRARY).toLowerCase();
    for (const banned of ["guaranteed to", "guarantees", "100%", "will cure", "cures erectile", "permanent cure", "miracle", "unatibu", "inatibu", "huponya", "kutibu kabisa", "tsh", "0655", "0635", "kayapower", "whatsapp"]) {
      expect(text.includes(banned), banned).toBe(false);
    }
  });
  it("quizzes have valid answers and tools have a tool id", () => {
    for (const c of LIBRARY) {
      if (c.kind === "quiz") c.quiz!.forEach((q) => expect(q.answer).toBeLessThan(q.options.length));
      if (c.kind === "tool") expect(c.tool).toBeTruthy();
    }
  });
  it("fills all ten built-in topic pages (7 topics incl. Fertility + 3 formats); Audio waits for Studio content", () => {
    expect(SECTIONS).toHaveLength(11);
    for (const s of SECTIONS.filter((x) => !OPTIONAL_SECTIONS.includes(x.id))) expect(sectionItems(s.id).length, s.id).toBeGreaterThan(0);
    expect(topicTiles(LIBRARY).some((t) => t.id === "audio")).toBe(false);
  });
});

describe("featured content", () => {
  it("prefers real content over samples when he has no interests", () => {
    expect(pickFeatured([])?.fixture).toBe(false);
  });
  it("uses samples only when there is no real content", () => {
    expect(pickFeatured([], LIBRARY.filter((c) => c.fixture))?.id).toBe("erection-guide");
  });
  it("favours a topic he chose", () => {
    expect(pickFeatured(["intimacy"])?.topic).toBe("intimacy");
    expect(pickFeatured(["ejaculation"])?.topic).toBe("ejaculation");
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

describe("Kiswahili search", () => {
  it("finds content by Kiswahili words", () => {
    const ids = searchContent("gesi tumbo").map((c) => c.id);
    expect(ids).toContain("ig-eating-day-calm-stomach");
    expect(ids).toContain("ig-gas-bloating-habits");
    expect(searchContent("kurudia tendo")[0].id).toBe("ig-second-round");
  });
});

const none: Personal = { interests: [], bookmarks: {}, history: {} };

describe("Discover home: show less, deliver more", () => {
  it("featured rotates daily among the best few, and avoids what he already read", () => {
    const days = new Set([0, 1, 2, 3].map((d) => featuredToday(none, LIBRARY, d)?.id));
    expect(days.size).toBeGreaterThan(1);
    const today = featuredToday(none, LIBRARY, 5)!;
    expect(featuredToday({ ...none, history: { [today.id]: "x" } }, LIBRARY, 5)?.id).not.toBe(today.id);
  });
  it("gives a new man three good starting points from different topics", () => {
    const r = recommendations(none, LIBRARY);
    expect(r).toHaveLength(3);
    expect(new Set(r.map((x) => x.item.topic)).size).toBe(3);
    expect(r.every((x) => x.reason === "A good place to start")).toBe(true);
  });
  it("recommends his chosen topic first and says why", () => {
    const r = recommendations({ ...none, interests: ["fertility"] }, LIBRARY);
    expect(r[0].item.topic).toBe("fertility");
    expect(r[0].reason).toBe("Because you follow Fertility");
  });
  it("learns from what he saves and reads, and skips what he already read", () => {
    const read = LIBRARY.find((c) => c.id === "lasting-longer")!;
    const r = recommendations({ ...none, history: { [read.id]: "x" } }, LIBRARY);
    expect(r.some((x) => x.item.id === read.id)).toBe(false);
    expect(r.some((x) => x.item.topic === "ejaculation" && x.reason.startsWith("Because you read"))).toBe(true);
  });
  it("never repeats the featured item", () => {
    const f = featuredToday(none, LIBRARY, 0)!;
    expect(recommendations(none, LIBRARY, [f.id]).some((x) => x.item.id === f.id)).toBe(false);
  });
  it("shows at most two short videos and one question", () => {
    expect(quickVideos(none, LIBRARY).length).toBeLessThanOrEqual(2);
    expect(quickVideos(none, LIBRARY).every((c) => c.kind === "video")).toBe(true);
    expect(questionToday(none, LIBRARY, 0)?.kind).toBe("expert");
  });
  it("keeps the whole library reachable through topic pages", () => {
    const tiles = topicTiles(LIBRARY);
    expect(tiles.find((t) => t.id === "fertility")?.count).toBeGreaterThan(0);
    const reachable = new Set(tiles.flatMap((t) => sectionAll(t.id, LIBRARY).map((c) => c.id)));
    expect(LIBRARY.every((c) => reachable.has(c.id))).toBe(true);
  });
});

describe("Featured pins from the Content Studio", () => {
  const base = { interests: [], bookmarks: {}, history: {} };
  const lib = LIBRARY.map((c) => ({ ...c }));
  const pin = (id: string, extra: object = {}) => ({ ...lib.find((c) => c.kind === "guide")!, id, featured: true, priority: 50, ...extra });

  it("a pinned item is always the featured card", () => {
    const pinned = pin("pinned-one");
    for (let d = 0; d < 5; d++) expect(featuredToday(base, [...lib, pinned], d)?.id).toBe("pinned-one");
  });
  it("several pins take turns day by day", () => {
    const shown = new Set([0, 1, 2, 3].map((d) => featuredToday(base, [...lib, pin("pin-a"), pin("pin-b")], d)?.id));
    expect(shown).toEqual(new Set(["pin-a", "pin-b"]));
  });
  it("prefers a pin he hasn't read", () => {
    const p = { ...base, history: { "pin-a": "2026-10-01" } };
    for (let d = 0; d < 4; d++) expect(featuredToday(p, [...lib, pin("pin-a"), pin("pin-b")], d)?.id).toBe("pin-b");
  });
  it("a pinned video or expert answer can be featured, a quiz can't", () => {
    expect(featuredToday(base, [...lib, pin("pin-video", { kind: "video" })], 0)?.id).toBe("pin-video");
    expect(featuredToday(base, [...lib, pin("pin-quiz", { kind: "quiz" })], 0)?.id).not.toBe("pin-quiz");
  });
});
