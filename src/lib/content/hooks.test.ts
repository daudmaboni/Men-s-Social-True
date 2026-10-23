import { describe, expect, it } from "vitest";
import { challengePoints, challengeState, dropCards, dropTimes, seriesOf, seriesOpen, seriesProgress, shareText, untilText, CHALLENGE_DAY_POINTS } from "./hooks";
import { cleanAction, seriesId } from "./action-shape";
import { topicQueue } from "./reels";
import type { ActionSpec, ContentItem } from "./types";

const card = (id: string, spec: Partial<ActionSpec> = {}, item: Partial<ContentItem> = {}) => ({
  item: { id, kind: "guide", topic: "erection", title: id, summary: "", minutes: 1, priority: 50, tags: [], source: "x", review: "reviewed", fixture: false, cover: { tone: "forest", motif: "rings" }, ...item } as ContentItem,
  spec: { type: "technique", challenges: ["last"], results: "days", steps: [{ text: "a", textSw: "a" }], ...spec } as ActionSpec,
});
const s = (part: number) => ({ id: "five-nights", name: "Five nights", nameSw: "Usiku tano", part });

describe("series", () => {
  const cards = [card("p2", { series: s(2) }), card("p1", { series: s(1) }), card("p3", { series: s(3) }), card("solo")];
  const all = seriesOf(cards);
  it("groups parts in order", () => {
    expect(all.get("five-nights")!.parts.map((p) => p.item.id)).toEqual(["p1", "p2", "p3"]);
  });
  it("opens part 2 the day after part 1", () => {
    expect(seriesOpen(cards[0], all, {}, "2026-10-24")).toBe(false);
    expect(seriesOpen(cards[0], all, { p1: "2026-10-24" }, "2026-10-24")).toBe(false);
    expect(seriesOpen(cards[0], all, { p1: "2026-10-24" }, "2026-10-25")).toBe(true);
    expect(seriesOpen(cards[0], all, { p1: "2026-10-24" }, "2026-10-24", false)).toBe(true);
    expect(seriesOpen(cards[1], all, {}, "2026-10-24")).toBe(true);
    expect(seriesOpen(cards[3], all, {}, "2026-10-24")).toBe(true);
  });
  it("knows where he is", () => {
    const p = seriesProgress(all.get("five-nights")!, { p1: "2026-10-24" }, "2026-10-24");
    expect(p).toMatchObject({ done: 1, total: 3, opensOn: "2026-10-25", finished: false, started: true });
    expect(p.next?.item.id).toBe("p2");
    expect(seriesProgress(all.get("five-nights")!, { p1: "a", p2: "b", p3: "c" }, "2026-10-24").finished).toBe(true);
  });
});

describe("challenges", () => {
  const e = { start: "2026-10-20", at: "x", length: 3, days: { "2026-10-20": "x", "2026-10-23": "y" } };
  it("never fails him for missed days", () => {
    expect(challengeState(e, "2026-10-24")).toMatchObject({ day: 3, done: 2, doneToday: false, finished: false, stale: false });
    expect(challengeState({ ...e, days: { ...e.days, "2026-10-24": "z" } }, "2026-10-24").finished).toBe(true);
  });
  it("puts away one he left long ago", () => {
    expect(challengeState(e, "2026-12-01").stale).toBe(true);
  });
  it("gives points per day and for finishing", () => {
    const f = { ...e, finished: { localDate: "2026-10-23", at: "y", points: 30 } };
    expect(challengePoints({ a: f }, "2026-10-23")).toBe(CHALLENGE_DAY_POINTS + 30);
    expect(challengePoints({ a: f }, "2026-10-21")).toBe(0);
  });
});

describe("the daily drop", () => {
  it("finds the last and next drop", () => {
    const now = new Date(2026, 9, 24, 21, 0);
    const t = dropTimes("20:00", now)!;
    expect(t.last.getHours()).toBe(20);
    expect(t.last.getDate()).toBe(24);
    expect(t.next.getDate()).toBe(25);
    const early = dropTimes("20:00", new Date(2026, 9, 24, 9, 0))!;
    expect(early.last.getDate()).toBe(23);
    expect(dropTimes("nope", now)).toBeNull();
  });
  it("picks the cards from today's drop", () => {
    const now = new Date(2026, 9, 24, 21, 0);
    const fresh = card("new", {}, { publishedAt: new Date(2026, 9, 24, 19, 30).toISOString() });
    const old = card("old", {}, { publishedAt: new Date(2026, 9, 23, 20, 0).toISOString() });
    const built = card("built", {}, { publishedAt: new Date(2026, 9, 24, 20, 0).toISOString(), builtIn: true });
    expect(dropCards([old, fresh, built], "20:00", now).map((c) => c.item.id)).toEqual(["new"]);
  });
  it("says how long until the next one", () => {
    expect(untilText(200 * 60_000, false)).toBe("in 3 h 20 min");
    expect(untilText(45 * 60_000, true)).toBe("baada ya dakika 45");
  });
});

describe("sharing", () => {
  it("uses a safe title, never the card's own", () => {
    expect(shareText(undefined, "https://x/c", true)).toContain("Kitu muhimu");
    expect(shareText({ shareTitle: "Morning drink", shareTitleSw: "Kinywaji cha asubuhi" }, "https://x/c", false)).toBe("Morning drink 👉 https://x/c");
  });
});

describe("hook fields survive the database", () => {
  it("keeps good ones and drops bad ones", () => {
    const a = cleanAction({
      type: "food",
      challenges: ["hard"],
      steps: [{ text: "Eat", textSw: "Kula" }],
      ask: { kind: "truefalse", q: "Beetroot helps blood flow", a: "True: it has nitrates.", truth: true },
      series: { name: "Five Nights!", part: "2", tease: "Tomorrow: breathing" },
      challengeDays: 7,
      shareTitle: "A morning drink",
    })!;
    expect(a.ask).toMatchObject({ kind: "truefalse", qSw: "Beetroot helps blood flow", truth: true });
    expect(a.series).toMatchObject({ id: "five-nights", part: 2, teaseSw: "Tomorrow: breathing" });
    expect(a.challengeDays).toBe(7);
    expect(a.shareTitleSw).toBe("A morning drink");
    const b = cleanAction({ type: "food", challenges: ["hard"], steps: [{ text: "x" }], ask: { q: "no answer" }, series: { name: "x", part: 0 }, challengeDays: 4 })!;
    expect(b.ask).toBeUndefined();
    expect(b.series).toBeUndefined();
    expect(b.challengeDays).toBeUndefined();
    expect(seriesId("Siku 7 za Nguvu")).toBe("siku-7-za-nguvu");
  });
});

describe("reels keep to his topic", () => {
  it("queues the same circle next", () => {
    const r = (id: string, tags: string[]) => ({ id, tags }) as unknown as ContentItem;
    const list = [r("a", ["last"]), r("b", ["hard"]), r("c", ["last"]), r("d", ["her"]), r("e", ["last"])];
    expect(topicQueue(list, 2, (x) => x.tags).map((x) => x.id)).toEqual(["c", "e", "a", "d", "b"]);
  });
});

describe("built-in starter hooks (Step 86)", () => {
  it("make one whole series with no gaps, and survive the database check", async () => {
    const { ACTION_CONTENT } = await import("./actions");
    const cards = ACTION_CONTENT.map((item) => ({ item, spec: item.action! }));
    const s = seriesOf(cards).get("last-longer-in-5-nights")!;
    expect(s.parts.map((p) => p.spec.series!.part)).toEqual([1, 2, 3, 4, 5]);
    for (const c of cards) expect(cleanAction(c.spec)).toEqual(c.spec);
  });
});

describe("the feed learns (Step 86)", () => {
  it("brings the kinds he uses forward and the next part of his series to the top", async () => {
    const { orderCards, DEFAULT_DISCOVER } = await import("./discover");
    const mk = (id: string, type: ActionSpec["type"]) => card(id, { type });
    const cards = [...Array.from({ length: 12 }, (_, i) => mk(`f${i}`, "food")), ...Array.from({ length: 12 }, (_, i) => mk(`x${i}`, "exercise"))];
    const empty = { interests: [], opened: {}, liked: {}, done: {} };
    const likesFood = { ...empty, done: { f0: "a", f1: "a", f2: "a" }, liked: { f3: "a" } };
    let food = 0;
    for (let i = 0; i < 30; i++) food += orderCards(cards, `s${i}`, likesFood, DEFAULT_DISCOVER).slice(0, 5).filter((c) => c.spec.type === "food").length;
    expect(food).toBeGreaterThan(75); // more than half of the top 5
    const next = orderCards(cards, "s", { ...empty, nextParts: new Set(["x7"]) }, DEFAULT_DISCOVER);
    expect(next[0].item.id).toBe("x7");
  });
});
