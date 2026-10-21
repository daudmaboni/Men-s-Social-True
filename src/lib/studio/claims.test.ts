import { describe, expect, it } from "vitest";
import { checkClaims, hasBlocks } from "./claims";
import { LIBRARY } from "../content/library";

const t = (text: string) => checkClaims({ title: "Test title", body: [text] });
const rules = (text: string) => t(text).map((i) => `${i.level}:${i.rule}`);

describe("claim checker", () => {
  it("blocks Tanzanian phone numbers in any format", () => {
    for (const p of ["0712 345 678", "+255 754 123 456", "255712345678", "0687-123-456"]) {
      expect(rules(`Call ${p}`), p).toContain("block:phone");
    }
  });
  it("blocks prices and ordering", () => {
    expect(rules("Only TZS 170,000")).toContain("block:price");
    expect(rules("Bei ni 50,000/=")).toContain("block:price");
    expect(rules("Order now and get it today")).toContain("block:order");
    expect(rules("Agiza sasa")).toContain("block:order");
    expect(rules("Chat on wa.me/255712345678")).toContain("block:link");
  });
  it("blocks guarantees and cure promises (English and Kiswahili)", () => {
    expect(rules("Works 100% of the time")).toContain("block:guarantee");
    expect(rules("Guaranteed results")).toContain("block:guarantee");
    expect(rules("This tea cures erectile problems")).toContain("block:cure-promise");
    expect(rules("Mchanganyiko huu unatibu nguvu za kiume")).toContain("block:cure-promise");
  });
  it("allows sentences that warn readers about such promises", () => {
    expect(rules("Be careful with products that promise guaranteed results.")).toEqual([]);
    expect(rules("Guaranteed results. Buy today.")).toContain("block:guarantee");
  });
  it("medical words on their own are fine (Step 66b: no cure-word warning)", () => {
    expect(t("A doctor can explain treatment options.")).toEqual([]);
    expect(t("Tiba asilia ya kuongeza nguvu")).toEqual([]);
  });
  it("does not double-report a blocked phrase as a warning", () => {
    expect(rules("It cures erectile issues")).toEqual(["block:cure-promise"]);
  });
  it("checks the Kiswahili text and quiz answers too", () => {
    expect(hasBlocks(checkClaims({ title: "Hi there", bodySw: ["Piga simu sasa"] }))).toBe(true);
    expect(
      hasBlocks(checkClaims({ title: "Quiz", quiz: [{ q: "Q?", options: ["Guaranteed", "No"], answer: 1, explain: "" }] })),
    ).toBe(true);
  });
  it("passes clean educational text", () => {
    expect(t("Sleep 7 to 9 hours. Walk for 30 minutes most days. See a doctor if it keeps happening.")).toEqual([]);
  });
  it("finds nothing blocked in the content already in the app", () => {
    for (const c of LIBRARY) {
      const blocks = checkClaims(c).filter((i) => i.level === "block");
      expect(blocks, `${c.id}: ${blocks.map((b) => b.match).join(", ")}`).toEqual([]);
    }
  });
});
