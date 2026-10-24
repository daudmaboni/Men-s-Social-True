import { describe, expect, it } from "vitest";
import { fitSize } from "./shrinkPhoto";

describe("own photo upload (Step 93)", () => {
  it("makes big phone photos 1600 px on the long side and never enlarges small ones", () => {
    expect(fitSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitSize(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

});
