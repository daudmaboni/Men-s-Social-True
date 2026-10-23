import { describe, expect, it } from "vitest";
import { stillTimes } from "./listen";

describe("stillTimes", () => {
  it("spreads stills evenly, never at the very start or end", () => {
    expect(stillTimes(60, 6)).toEqual([5, 15, 25, 35, 45, 55]);
  });
  it("takes fewer stills from very short videos", () => {
    expect(stillTimes(2, 6)).toEqual([0.5, 1.5]);
  });
  it("copes with an unknown length", () => {
    expect(stillTimes(NaN)).toEqual([0]);
    expect(stillTimes(0)).toEqual([0]);
  });
});
