import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearWork, keepWork, takeWork } from "./previewHandoff";
import { DEFAULT_CONFIG } from "./config";

beforeEach(() => {
  const m = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) });
});

describe("unsaved homepage changes travel to the preview and back", () => {
  const changed = { ...DEFAULT_CONFIG, sections: [...DEFAULT_CONFIG.sections].reverse() };
  it("comes back when the saved layout is the same", () => {
    keepWork(changed, DEFAULT_CONFIG);
    expect(takeWork(DEFAULT_CONFIG)).toEqual(changed);
  });
  it("is ignored once the saved layout has changed (e.g. someone published)", () => {
    keepWork(changed, DEFAULT_CONFIG);
    expect(takeWork(changed)).toBeNull();
  });
  it("is gone after saving or publishing", () => {
    keepWork(changed, DEFAULT_CONFIG);
    clearWork();
    expect(takeWork(DEFAULT_CONFIG)).toBeNull();
  });
});
