import { describe, expect, it } from "vitest";
import { captionPreview, cleanTitle, isLongCaption, parseCaption } from "./caption";

const IG =
  "Mchanganyiko huu umejaa virutubisho vinavyosaidia nguvu ya mwili na afya ya uzazi kwa mwanaume. MAHITAJI: • Ndizi 2 zilizogandishwa • Blueberries na stroberi (au komamanga / pera / tikiti maji) • Papai • Tini kavu na tende (au tende peke yake) • Lozi na korosho (au karanga) • Mbegu za maboga (au ufuta) • Maziwa Saga vyote kwenye blenda hadi vilainike. INASAIDIAJE: ✅ Mbegu za maboga na korosho zina ZINKI, madini muhimu kwa uzalishaji wa mbegu za kiume ✅ Lozi zina VITAMINI E, inayolinda ubora wa mbegu #kayaniherbs #afya";

describe("reel titles (Step 81)", () => {
  it("drops the brand, the '...' and the shouting", () => {
    expect(cleanTitle("Kayani Herbs Kama Unataka Kuwa Unamwaga Bao ZITOO... Tumia Hii")).toBe("Kama Unataka Kuwa Unamwaga Bao zitoo, Tumia Hii");
  });
  it("keeps short forms and cuts long titles at a word", () => {
    expect(cleanTitle("Imesajiliwa na TMDA")).toBe("Imesajiliwa na TMDA");
    const t = cleanTitle("Neno ".repeat(40));
    expect(t.length).toBeLessThanOrEqual(91);
    expect(t.endsWith("…")).toBe(true);
  });
  it("never ends up empty", () => {
    expect(cleanTitle("Kayani Herbs")).toBe("Kayani Herbs");
  });
});

describe("reel captions (Step 81)", () => {
  const blocks = parseCaption(IG);
  it("splits the Instagram text into a paragraph, headings, bullets and ✅ points", () => {
    expect(blocks[0]).toEqual({ kind: "text", text: "Mchanganyiko huu umejaa virutubisho vinavyosaidia nguvu ya mwili na afya ya uzazi kwa mwanaume." });
    expect(blocks[1]).toEqual({ kind: "heading", text: "Mahitaji" });
    expect(blocks[2]).toEqual({ kind: "item", mark: "•", text: "Ndizi 2 zilizogandishwa" });
    expect(blocks.filter((b) => b.kind === "heading").map((b) => b.text)).toEqual(["Mahitaji", "Inasaidiaje"]);
    expect(blocks.filter((b) => b.kind === "item" && b.mark === "✅")).toHaveLength(2);
  });
  it("tames capitals inside points and drops the hashtags at the end", () => {
    const zinc = blocks.find((b) => b.text.startsWith("Mbegu za maboga na korosho"));
    expect(zinc?.text).toContain("zina zinki");
    expect(blocks.some((b) => b.text.includes("#"))).toBe(false);
  });
  it("shows a short preview with 'more' only when there is more", () => {
    expect(captionPreview(IG).startsWith("Mchanganyiko huu")).toBe(true);
    expect(isLongCaption(IG)).toBe(true);
    expect(isLongCaption("Short and sweet.")).toBe(false);
  });
});
