import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, normalizeConfig, resolveDiscover, wordsFor } from "./config";
import { LIBRARY } from "../content/library";

const newMan = { interests: [], bookmarks: {}, history: {} };

describe("homepage layout", () => {
  it("fills in missing sections and drops unknown ones", () => {
    const c = normalizeConfig({ sections: [{ id: "topics", visible: false }, { id: "ads" }, { id: "topics" }] });
    expect(c.sections.map((s) => s.id)).toEqual(["topics", "featured", "for_you", "videos", "question"]);
    expect(c.sections[0].visible).toBe(false);
    expect(normalizeConfig(null)).toEqual(DEFAULT_CONFIG);
  });

  it("bounds counts, cleans ids and words", () => {
    const c = normalizeConfig({ sections: [{ id: "for_you", count: 99, items: ["ok-id", "BAD ID", "ok-id"], title: { en: "  Top picks ", sw: "" } }] });
    expect(c.sections[0]).toEqual({ id: "for_you", visible: true, count: 5, items: ["ok-id"], title: { en: "Top picks" } });
    expect(wordsFor(c.sections[0].title, "sw")).toBe("Top picks");
  });

  it("with no staff choices, Discover is exactly the personalised default", () => {
    const r = resolveDiscover(DEFAULT_CONFIG, newMan, LIBRARY, 5);
    expect(r.forYou).toHaveLength(3);
    expect(r.tiles.length).toBeGreaterThan(5);
  });

  it("staff picks come first; his own recommendations fill the rest", () => {
    const guide = LIBRARY.find((c) => c.kind === "article" && c.topic !== "confidence")!;
    const cfg = normalizeConfig({ sections: [{ id: "for_you", items: [guide.id], count: 3 }] });
    const me = { interests: ["confidence" as const], bookmarks: {}, history: {} };
    const r = resolveDiscover(cfg, me, LIBRARY, 5);
    expect(r.forYou[0].item.id).toBe(guide.id);
    expect(r.forYou[0].reason).toBe("Picked by our editors");
    expect(r.forYou.slice(1).some((x) => x.reason === "Because you follow {topic}".replace("{topic}", "Confidence"))).toBe(true);
  });

  it("featured picks rotate daily and skip ones he read", () => {
    const [a, b] = LIBRARY.filter((c) => c.kind === "guide").slice(0, 2);
    const cfg = normalizeConfig({ sections: [{ id: "featured", items: [a.id, b.id] }] });
    expect(new Set([0, 1].map((d) => resolveDiscover(cfg, newMan, LIBRARY, d).featured?.id))).toEqual(new Set([a.id, b.id]));
    const read = { ...newMan, history: { [a.id]: "2026-10-01" } };
    expect([0, 1].map((d) => resolveDiscover(cfg, read, LIBRARY, d).featured?.id)).toEqual([b.id, b.id]);
  });

  it("topic tiles follow the chosen order and selection; wrong kinds are ignored", () => {
    const video = LIBRARY.find((c) => c.kind === "video")!;
    const cfg = normalizeConfig({ sections: [{ id: "topics", items: ["videos", "fertility"] }, { id: "question", items: [video.id] }] });
    const r = resolveDiscover(cfg, newMan, LIBRARY, 1);
    expect(r.tiles.map((t) => t.id)).toEqual(["videos", "fertility"]);
    expect(r.question?.kind).toBe("expert"); // a video can't be the question, so the normal choice is used
  });
});
