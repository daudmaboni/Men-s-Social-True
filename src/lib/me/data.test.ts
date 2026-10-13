import { describe, expect, it } from "vitest";
import { deleteMyData, exportMyData } from "./data";

function fakeStorage(init: Record<string, string>) {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    removeItem: (k: string) => void m.delete(k),
    m,
  };
}

describe("my data", () => {
  const init = {
    ms_progress_v1: JSON.stringify({ records: [{ value: 250 }] }),
    ms_lang: "sw",
    ms_content_cache_v1: "[]",
    "sb-abc-auth-token": "secret",
    other_site: "x",
  };
  it("exports only this app's personal data", () => {
    const out = exportMyData(fakeStorage(init), new Date("2026-10-13T10:00:00Z"));
    expect(Object.keys(out.data)).toEqual(["ms_lang", "ms_progress_v1"]);
    expect(out.data.ms_progress_v1).toEqual({ records: [{ value: 250 }] });
    expect(out.data.ms_lang).toBe("sw");
  });
  it("deletes his data but nothing else", () => {
    const s = fakeStorage(init);
    expect(deleteMyData(s)).toBe(2);
    expect([...s.m.keys()].sort()).toEqual(["ms_content_cache_v1", "other_site", "sb-abc-auth-token"]);
  });
});
