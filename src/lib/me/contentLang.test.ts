import { describe, expect, it } from "vitest";
import { OFFER_DAYS, shouldOffer, withShown, type OfferState } from "./contentLang";

const none: OfferState = { days: [] };

describe("Read in English? offer (Step 94)", () => {
  it("shows on the first visit", () => {
    expect(shouldOffer(none, "2026-10-24", "sw")).toBe(true);
  });

  it("shows at most once a day", () => {
    const s = withShown(none, "2026-10-24");
    expect(shouldOffer(s, "2026-10-24", "sw")).toBe(false);
    expect(shouldOffer(s, "2026-10-25", "sw")).toBe(true);
  });

  it("stops for good after 3 different days", () => {
    let s = none;
    for (const d of ["2026-10-24", "2026-10-25", "2026-10-27"]) s = withShown(s, d);
    expect(s.days).toHaveLength(OFFER_DAYS);
    expect(shouldOffer(s, "2026-10-28", "sw")).toBe(false);
    expect(shouldOffer(s, "2027-01-01", "sw")).toBe(false);
  });

  it("never shows after 'don't show again'", () => {
    expect(shouldOffer({ days: [], never: true }, "2026-10-24", "sw")).toBe(false);
  });

  it("never shows when he already reads in English", () => {
    expect(shouldOffer(none, "2026-10-24", "en")).toBe(false);
  });

  it("recording the same day twice keeps one entry", () => {
    expect(withShown(withShown(none, "2026-10-24"), "2026-10-24").days).toEqual(["2026-10-24"]);
  });
});
