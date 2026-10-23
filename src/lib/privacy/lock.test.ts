import { describe, expect, it } from "vitest";
import { checkPin, makeLock, validPin, waitAfter } from "./lock";

describe("the private lock", () => {
  it("never keeps the PIN itself, and checks it", async () => {
    const cfg = await makeLock("4821");
    expect(JSON.stringify(cfg)).not.toContain("4821");
    expect((await checkPin(cfg, "4821")).ok).toBe(true);
    expect((await checkPin(cfg, "1234")).ok).toBe(false);
    expect(validPin("12a4")).toBe(false);
  });
  it("makes him wait after 5 wrong tries, longer each time", async () => {
    expect([1, 4, 5, 6, 7].map(waitAfter)).toEqual([0, 0, 30_000, 60_000, 120_000]);
    expect(waitAfter(40)).toBe(15 * 60_000);
    let cfg = await makeLock("4821");
    for (let i = 0; i < 5; i++) cfg = (await checkPin(cfg, "0000", 1000)).cfg;
    const blocked = await checkPin(cfg, "4821", 2000);
    expect(blocked.ok).toBe(false);
    expect(blocked.wait).toBeGreaterThan(0);
    expect((await checkPin(cfg, "4821", 1000 + 31_000)).ok).toBe(true);
  });
});
