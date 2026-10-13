import { describe, expect, it } from "vitest";
import { itemToRow, mergeLibrary, rowToItem } from "./rows";
import { LIBRARY } from "./library";
import type { ContentItem } from "./types";

const sample: ContentItem = {
  ...LIBRARY[0],
  id: "my-first-guide",
  title: "  My first guide ",
  titleSw: "Mwongozo wangu",
  body: ["## Start", "Hello"],
  bodySw: ["Habari"],
  fixture: false,
};

describe("database rows", () => {
  it("round-trips an item through a row", () => {
    const row = itemToRow(sample, "published");
    expect(row.title).toBe("My first guide");
    expect(row.status).toBe("published");
    const back = rowToItem({ ...row, updated_at: "2026-10-13T10:00:00Z" })!;
    expect(back).toMatchObject({ id: "my-first-guide", title: "My first guide", titleSw: "Mwongozo wangu", body: ["## Start", "Hello"], status: "published", builtIn: false, fixture: false });
  });
  it("ignores broken rows instead of crashing", () => {
    expect(rowToItem({ id: "x" })).toBeNull();
    expect(rowToItem({ id: "abc", title: "T", kind: "podcast" as never, topic: "erection" })).toBeNull();
    const ok = rowToItem({ id: "abc", title: "T", kind: "article", topic: "erection", body: [1, "a"] as never, tags: null as never })!;
    expect(ok.body).toEqual(["a"]);
    expect(ok.tags).toEqual([]);
  });
});

describe("merging built-in and published content", () => {
  it("adds published items and lets them replace a built-in item with the same id", () => {
    const edited = { ...LIBRARY[0], title: "Edited by Daud", status: "published" as const, fixture: false };
    const fresh = { ...sample, status: "published" as const };
    const merged = mergeLibrary(LIBRARY, [edited, fresh]);
    expect(merged).toHaveLength(LIBRARY.length + 1);
    expect(merged.find((c) => c.id === LIBRARY[0].id)?.title).toBe("Edited by Daud");
  });
  it("never shows drafts", () => {
    const merged = mergeLibrary(LIBRARY, [{ ...sample, status: "draft" }]);
    expect(merged.some((c) => c.id === sample.id)).toBe(false);
  });
});
