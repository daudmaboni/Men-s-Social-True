import { afterEach, describe, expect, it, vi } from "vitest";
import { pullCloses } from "./useSheetDrag";
import { originWithin } from "./origin";
import { PATTERNS, haptic, hapticsOn, setHapticsOn } from "./haptics";

describe("pulling a sheet down (Step 77)", () => {
  it("a quick flick down closes it, even a short one", () => {
    expect(pullCloses(20, 900, 500)).toBe(true);
  });
  it("a slow pull must pass about a third of the way", () => {
    expect(pullCloses(100, 0, 500)).toBe(false);
    expect(pullCloses(180, 0, 500)).toBe(true);
  });
  it("flicked back up, it stays open even after a long pull", () => {
    expect(pullCloses(260, -600, 500)).toBe(false);
  });
});

describe("pop-ups grow out of their button", () => {
  const box = { left: 100, top: 200, width: 300, height: 400 } as DOMRect;
  it("uses the button's centre, even outside the pop-up", () => {
    expect(originWithin(box, { left: 360, top: 20, width: 40, height: 40 } as DOMRect)).toBe("280px -160px");
  });
  it("falls back to the middle when no button was pressed", () => {
    expect(originWithin(box, null)).toBe("50% 50%");
  });
});

describe("vibration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("keeps every buzz short", () => {
    for (const p of Object.values(PATTERNS)) {
      const total = Array.isArray(p) ? p.reduce((a, b) => a + b, 0) : p;
      expect(total).toBeLessThanOrEqual(200);
    }
  });
  it("buzzes when on, stays quiet when he switched it off, and never stacks two at once", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });
    expect(hapticsOn()).toBe(true);
    setHapticsOn(false);
    vibrate.mockClear();
    haptic("done");
    expect(vibrate).not.toHaveBeenCalled();
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    setHapticsOn(true); // turning it on gives one buzz so he feels it
    expect(vibrate).toHaveBeenCalledTimes(1);
    vi.setSystemTime(10_030);
    haptic("tick"); // too soon after the last one
    expect(vibrate).toHaveBeenCalledTimes(1);
    vi.setSystemTime(10_200);
    haptic("level");
    expect(vibrate).toHaveBeenLastCalledWith(PATTERNS.level);
    vi.useRealTimers();
  });
  it("does nothing on phones without vibration (iPhones)", () => {
    vi.stubGlobal("navigator", {});
    expect(() => haptic("done")).not.toThrow();
  });
});
