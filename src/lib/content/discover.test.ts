import { describe, expect, it } from "vitest";
import { ACTION_CONTENT, actionOf } from "./actions";
import { DEFAULT_DISCOVER, normalizeDiscover, orderCards, orderReels, placeReels, reelEvery, spreadKinds, type FeedCard, type Taste } from "./discover";
import type { ContentItem } from "./types";

const cards: FeedCard[] = ACTION_CONTENT.map((item) => ({ item, spec: actionOf(item)! }));
const empty: Taste = { interests: [], opened: {}, liked: {}, done: {} };
const ids = (l: FeedCard[]) => l.map((c) => c.item.id);

describe("Discover order (Step 71)", () => {
  it("changes from visit to visit and from man to man, but stays put within a visit", () => {
    const a1 = ids(orderCards(cards, "manA:visit1", empty, DEFAULT_DISCOVER));
    const a1again = ids(orderCards(cards, "manA:visit1", empty, DEFAULT_DISCOVER));
    const a2 = ids(orderCards(cards, "manA:visit2", empty, DEFAULT_DISCOVER));
    const b1 = ids(orderCards(cards, "manB:visit1", empty, DEFAULT_DISCOVER));
    expect(a1again).toEqual(a1);
    expect(a2.slice(0, 5)).not.toEqual(a1.slice(0, 5));
    expect(b1.slice(0, 5)).not.toEqual(a1.slice(0, 5));
    expect(new Set(a1).size).toBe(cards.length); // nothing lost, nothing twice
  });
  it("the first card is not always the same across visits", () => {
    const firsts = new Set(Array.from({ length: 20 }, (_, i) => ids(orderCards(cards, `man:${i}`, empty, DEFAULT_DISCOVER))[0]));
    expect(firsts.size).toBeGreaterThan(8);
  });
  it("pinned cards stay on top; hidden ones are gone; done ones go last", () => {
    const [p1, p2, h, d] = ids(cards).slice(10, 14);
    const cfg = { ...DEFAULT_DISCOVER, pinned: [p2, p1], hidden: [h] };
    const out = ids(orderCards(cards, "s", { ...empty, done: { [d]: "x" } }, cfg));
    expect(out.slice(0, 2)).toEqual([p2, p1]);
    expect(out).not.toContain(h);
    expect(out.at(-1)).toBe(d);
  });
  it("cards he hasn't opened come before ones he has", () => {
    const opened = Object.fromEntries(ids(cards).slice(0, 40).map((id) => [id, "x"]));
    const out = ids(orderCards(cards, "s", { ...empty, opened }, DEFAULT_DISCOVER)).slice(0, 15);
    expect(out.filter((id) => opened[id]).length).toBeLessThan(5);
  });
  it("never three of the same kind in a row when there's another choice", () => {
    const out = spreadKinds(orderCards(cards, "x", empty, DEFAULT_DISCOVER));
    for (let i = 2; i < 30; i++) expect(out[i].spec.type === out[i - 1].spec.type && out[i].spec.type === out[i - 2].spec.type).toBe(false);
  });
  it("shuffle off: the same order for everyone", () => {
    const cfg = { ...DEFAULT_DISCOVER, shuffle: false };
    expect(ids(orderCards(cards, "a", empty, cfg))).toEqual(ids(orderCards(cards, "b", empty, cfg)));
  });
});

describe("Reels vs reading (Step 71)", () => {
  const cfg = DEFAULT_DISCOVER; // one reel every 6 cards
  it("uses the Studio setting until he has used Discover enough", () => {
    expect(reelEvery(cfg, { reelViews: 2, reelFinished: 2, reelSkipped: 0, cardActions: 1 })).toBe(6);
  });
  it("a watcher gets reels more often, but never more than one per 3 cards", () => {
    const n = reelEvery(cfg, { reelViews: 60, reelFinished: 55, reelSkipped: 0, cardActions: 2 });
    expect(n).toBeLessThan(6);
    expect(n).toBeGreaterThanOrEqual(3);
  });
  it("a reader gets fewer reels, but still some", () => {
    const n = reelEvery(cfg, { reelViews: 10, reelFinished: 0, reelSkipped: 9, cardActions: 50 });
    expect(n).toBeGreaterThan(6);
    expect(n).toBeLessThanOrEqual(12);
  });
  it("switching adapting off keeps the Studio setting for everyone", () => {
    expect(reelEvery({ ...cfg, adaptive: false }, { reelViews: 60, reelFinished: 60, reelSkipped: 0, cardActions: 0 })).toBe(6);
  });
  it("places each reel once: the first after card 1, then every N cards", () => {
    const reels = [1, 2, 3].map((i) => ({ id: `r${i}` }) as ContentItem);
    const at = placeReels(20, reels, 6);
    expect([...at.keys()]).toEqual([1, 7, 13]);
    expect(at.get(1)?.id).toBe("r1");
    expect([...placeReels(20, reels.slice(0, 1), 6).keys()]).toEqual([1]);
  });
  it("a feed with no cards still shows the first reel", () => {
    const reels = [{ id: "r1" } as ContentItem];
    expect([...placeReels(0, reels, 6).keys()]).toEqual([0]);
  });
  it("new reels before watched ones, in a different order per visit", () => {
    const reels = Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, publishedAt: `2026-10-${10 + i}` }) as ContentItem);
    const seen = { r0: "x", r1: "x" };
    const a = orderReels(reels, "v1", seen, cfg).map((r) => r.id);
    expect(a.slice(-2).sort()).toEqual(["r0", "r1"]);
    expect(orderReels(reels, "v2", seen, cfg).map((r) => r.id)).not.toEqual(a);
  });
  it("bad settings from the database are made safe", () => {
    expect(normalizeDiscover({ reelEvery: 1, pinned: "x" })).toMatchObject({ reelEvery: 3, pinned: [], adaptive: true });
    expect(normalizeDiscover(null)).toEqual(DEFAULT_DISCOVER);
  });
});
