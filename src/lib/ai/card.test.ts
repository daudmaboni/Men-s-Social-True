import { describe, expect, it } from "vitest";
import { buildCardMessage, CARD_SYSTEM, parseCard } from "./card";
import { htmlToText, safeUrl } from "./linkText";
import { cleanAction } from "../content/action-shape";
import { rowToItem, itemToRow } from "../content/rows";
import { studioCardToItem } from "../content/studio-card";
import { checkClaims } from "../studio/claims";

const reply = JSON.stringify({
  title: ["Clove tea before bed", "Chai ya karafuu kabla ya kulala"],
  hook: ["Five cloves, one cup.", "Karafuu tano, kikombe kimoja."],
  type: "mix",
  challenges: ["mixes", "desire", "nonsense"],
  results: "weeks2",
  minutes: 4,
  need: [["5 cloves", "Karafuu 5"]],
  steps: [
    { title: null, text: ["Boil the cloves.", "Chemsha karafuu."] },
    { title: ["Drink", "Kunywa"], text: ["Drink it warm.", "Kunywa ikiwa ya moto."] },
  ],
  why: ["Cloves push blood flow.", "Karafuu zinasukuma damu."],
  photo: "spiced-tea",
});

describe("Card maker: AI reply", () => {
  it("turns a good reply into a card, dropping unknown values", () => {
    const c = parseCard(`Here you go:\n${reply}\nThanks`);
    expect(c.title).toBe("Clove tea before bed");
    expect(c.titleSw).toBe("Chai ya karafuu kabla ya kulala");
    expect(c.action.challenges).toEqual(["mixes", "desire"]);
    expect(c.action.steps).toHaveLength(2);
    expect(c.action.steps[1].titleSw).toBe("Kunywa");
    expect(c.action.needSw).toEqual(["Karafuu 5"]);
    expect(c.photo).toBe("spiced-tea");
  });
  it("refuses replies with no steps or no JSON", () => {
    expect(() => parseCard("sorry")).toThrow();
    expect(() => parseCard(JSON.stringify({ title: ["A", "B"], challenges: ["last"], steps: [] }))).toThrow(/steps/);
  });
  it("falls back to a safe photo and clamps minutes", () => {
    const c = parseCard(JSON.stringify({ ...JSON.parse(reply), photo: "not-a-photo", minutes: 999 }));
    expect(c.photo).toBe("man-confident");
    expect(c.minutes).toBe(30);
  });
});

describe("Card maker: what the AI is sent", () => {
  it("sends PDFs and photos as files, and always asks for JSON", () => {
    const pdf = buildCardMessage({ kind: "pdf", base64: "AAA", name: "a.pdf" });
    expect(pdf[0]).toMatchObject({ type: "document", source: { media_type: "application/pdf" } });
    const img = buildCardMessage({ kind: "image", base64: "AAA", mediaType: "image/png", name: "a.png" }, "for married men");
    expect(img[0]).toMatchObject({ type: "image" });
    expect(JSON.stringify(img)).toContain("for married men");
    expect(JSON.stringify(img.at(-1))).toContain("ONLY valid JSON");
  });
  it("tells the AI the house rules: no disclaimers, no prices, human voice, both languages", () => {
    for (const rule of ["No disclaimers", "prices", "phone numbers", "big brother", "Kiswahili"]) expect(CARD_SYSTEM).toContain(rule);
  });
});

describe("Card maker: reading links safely", () => {
  it("only opens public web pages", () => {
    expect(safeUrl("https://kayaniherbs.co.tz/post")?.hostname).toBe("kayaniherbs.co.tz");
    for (const bad of ["http://localhost:3000", "https://127.0.0.1/x", "http://10.0.0.5", "http://192.168.1.1", "ftp://x.com", "javascript:alert(1)", "https://169.254.169.254/latest", "not a url"]) {
      expect(safeUrl(bad), bad).toBeNull();
    }
  });
  it("keeps the words, drops scripts and tags", () => {
    expect(htmlToText("<html><head><title>x</title></head><script>evil()</script><p>Chemsha&nbsp;maji</p><p>Kunywa</p></html>")).toBe("Chemsha maji\nKunywa");
  });
});

describe("Card maker: saving", () => {
  it("a card survives the trip to the database and back", () => {
    const d = parseCard(reply);
    const item = studioCardToItem({ id: "card-test-1", ...d, photo: d.photo });
    expect(item.aiGenerated).toBe(true);
    expect(item.bodySw?.length).toBe(item.body?.length);
    const back = rowToItem({ ...itemToRow(item, "published"), updated_at: "2026-10-21" });
    expect(back?.action).toEqual(item.action);
    expect(checkClaims(item).filter((i) => i.level === "block")).toEqual([]);
  });
  it("broken card data from the database is ignored, not shown", () => {
    expect(cleanAction({ steps: "x", challenges: ["last"] })).toBeUndefined();
    expect(cleanAction({ steps: [{ text: "Do it" }], challenges: [] })).toBeUndefined();
    expect(cleanAction({ steps: [{ text: "Do it" }], challenges: ["last"], type: "bad" })?.type).toBe("technique");
  });
});

describe("card from a reel with stills (Step 85)", () => {
  it("sends the stills as pictures before the words", () => {
    const blocks = buildCardMessage({ kind: "media", mediaKind: "video", name: "reel.mp4", notes: "What it says:\nKunywa maji asubuhi", frames: ["AAAA", "BBBB"] });
    expect(blocks.filter((b) => b.type === "image")).toHaveLength(2);
    expect(blocks[0].type).toBe("image");
    const text = blocks.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");
    expect(text).toMatch(/2 pictures above are stills/);
    expect(text).toMatch(/Kunywa maji asubuhi/);
  });
  it("never sends more than 6 stills", () => {
    const blocks = buildCardMessage({ kind: "media", mediaKind: "video", name: "r.mp4", notes: "", frames: Array(10).fill("AAAA") });
    expect(blocks.filter((b) => b.type === "image")).toHaveLength(6);
  });
});
