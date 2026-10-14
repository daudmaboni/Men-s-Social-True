import { describe, expect, it } from "vitest";
import { buildPrompt, DEFAULT_AI, parseResult } from "./prompts";

describe("AI prompts", () => {
  it("always carries the safety rules, tone, editor rules and approved sources", () => {
    const p = buildPrompt("draft", { topic: "sleep", brief: "basics" }, { ...DEFAULT_AI, rules: "Mention Kayani" }, ["WHO sleep guidance"]);
    expect(p.system).toMatch(/Never diagnose/);
    expect(p.system).toMatch(/Mention Kayani/);
    expect(p.system).toMatch(/WHO sleep guidance/);
    expect(p.user).toMatch(/sleep/);
  });
  it("reads JSON even with extra words around it", () => {
    expect(parseResult("summarize", 'Here you go:\n{"summary": "Short."}\nThanks')).toEqual({ summary: "Short." });
  });
  it("rejects missing fields and broken quizzes", () => {
    expect(() => parseResult("draft", '{"title": "x"}')).toThrow(/missing/);
    expect(() => parseResult("quiz", '{"questions": [{"q": "a", "options": ["x"], "answer": 3, "explain": ""}]}')).toThrow(/quiz/);
    expect(() => parseResult("titles", "no json")).toThrow();
  });
});
