import { describe, expect, it } from "vitest";
import { pinchResult, resolve } from "./theme";

describe("appearance", () => {
  it("auto follows the phone, light and dark are fixed", () => {
    expect(resolve("auto", true)).toBe("dark");
    expect(resolve("auto", false)).toBe("light");
    expect(resolve("light", true)).toBe("light");
    expect(resolve("dark", false)).toBe("dark");
  });
  it("spreading two fingers apart turns dark on, pinching them together turns it off", () => {
    expect(pinchResult(100, 200)).toBe("dark");
    expect(pinchResult(200, 100)).toBe("light");
  });
  it("ignores small or unclear movements", () => {
    expect(pinchResult(100, 120)).toBeNull();
    expect(pinchResult(100, 85)).toBeNull();
    expect(pinchResult(10, 200)).toBeNull();
  });
});
