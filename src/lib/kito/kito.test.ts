import { describe, expect, it } from "vitest";
import { LIBRARY } from "../content/library";
import { buildIndex, docsFromItems, docsFromLessons, search, tokens } from "./search";
import { buildKitoMessage, KITO_SYSTEM, parseKito, safetyFlag } from "./prompt";

const index = buildIndex([
  ...docsFromItems(LIBRARY.filter((c) => !c.fixture)),
  ...docsFromLessons("Mtie Wazimu Mkeo", [{ id: "wz-6-1", code: "6.1", title: "The Kegel exercise", titleSw: "Zoezi la Kegel" }]),
]);
const titles = (q: string) => search(index, q).map((h) => h.doc.title);

describe("Kito: finding the right guides", () => {
  it("finds guides for English and Kiswahili questions", () => {
    expect(titles("how can I last longer in bed").some((t) => /last|round/i.test(t))).toBe(true);
    expect(titles("maumivu ya tumbo na gesi")[0]).toMatch(/gas|bloating/i);
    expect(titles("beetroot drink")[0]).toMatch(/beetroot/i);
  });
  it("links course lessons too", () => {
    const h = search(index, "zoezi la kegel");
    expect(h.some((x) => x.doc.href === "/man/course/wz-6-1")).toBe(true);
  });
  it("finds nothing for questions the library doesn't cover", () => {
    expect(search(index, "bitcoin price today")).toEqual([]);
    expect(search(index, "who won the election")).toEqual([]);
  });
  it("ignores small words in both languages", () => {
    expect(tokens("Je, nifanye nini na hii?")).toEqual([]);
    expect(tokens("What is the best way")).toEqual([]);
  });
});

describe("Kito: rules", () => {
  it("only answers from the library and admits when it can't", () => {
    for (const rule of ["ONLY the numbered SOURCES", "Never fill the gap", "Never diagnose", "No product names, prices", "Kiswahili"]) expect(KITO_SYSTEM).toContain(rule);
  });
  it("sends his question with the sources, numbered", () => {
    const hits = search(index, "beetroot");
    const msg = buildKitoMessage("Is beetroot good?", hits, "sw");
    expect(msg).toContain("[1]");
    expect(msg).toContain("Kiswahili");
  });
  it("an answer that used no source is never shown as sure", () => {
    expect(parseKito('{"answer":"Drink it daily","used":[],"confident":true}', 3)).toMatchObject({ confident: false, used: [] });
    expect(parseKito('ok {"answer":"Yes","used":[1,9,1],"confident":true}', 3)).toMatchObject({ confident: true, used: [1] });
    expect(() => parseKito("sorry", 3)).toThrow();
  });
  it("spots a crisis and urgent body signs before any AI", () => {
    expect(safetyFlag("I want to kill myself")).toBe("crisis");
    expect(safetyFlag("nataka kujiua")).toBe("crisis");
    expect(safetyFlag("my erection won't go down for 5 hours")).toBe("urgent");
    expect(safetyFlag("kuna damu kwenye mkojo")).toBe("urgent");
    expect(safetyFlag("how do I last longer")).toBeNull();
  });
});
