import { describe, expect, it } from "vitest";
import { blankItem, fromParagraphs, ID_RULE, publishProblems, slugify, toLines, toParagraphs } from "./validate";

describe("editor helpers", () => {
  it("makes safe web addresses from titles", () => {
    expect(slugify("Sleep & your erections!")).toBe("sleep-and-your-erections");
    expect(slugify("  Vyakula vya nguvu — sehemu 2 ")).toBe("vyakula-vya-nguvu-sehemu-2");
    expect(ID_RULE.test(slugify("A long title about sleep"))).toBe(true);
  });
  it("splits paragraphs on blank lines and keeps headings", () => {
    const ps = toParagraphs("## Why it matters\n\nFirst line\ncontinues here.\n\n\nSecond.");
    expect(ps).toEqual(["## Why it matters", "First line continues here.", "Second."]);
    expect(toParagraphs(fromParagraphs(ps))).toEqual(ps);
  });
  it("splits key points by line", () => {
    expect(toLines(" one \n\n two")).toEqual(["one", "two"]);
  });
});

describe("before publishing", () => {
  it("lists what's missing on an empty item", () => {
    const p = publishProblems(blankItem());
    expect(p).toContain("Add a title.");
    expect(p).toContain("Write the text.");
  });
  it("accepts a complete article", () => {
    const item = { ...blankItem(), id: "walk-after-meals", title: "Walk after meals", summary: "A short walk helps digestion and energy.", body: ["Walk 10 minutes after eating."] };
    expect(publishProblems(item)).toEqual([]);
  });
  it("stops publishing when the claim check finds a block", () => {
    const item = { ...blankItem(), id: "bad-one", title: "Bad one", summary: "Call us for the best herbs.", body: ["Call 0712 345 678 today"] };
    expect(publishProblems(item)).toContain("Fix the red items in the claim check.");
  });
  it("checks quizzes and expert answers", () => {
    const quiz = { ...blankItem(), kind: "quiz" as const, id: "quiz-one", title: "Quiz one", summary: "Test what you know.", quiz: [{ q: "", options: ["Yes", ""], answer: 1, explain: "" }] };
    const p = publishProblems(quiz);
    expect(p).toContain("Question 1: write the question.");
    expect(p).toContain("Question 1: give at least two answers.");
    const expert = { ...blankItem(), kind: "expert" as const, id: "exp-one", title: "Exp one", summary: "An answer to a common question.", body: ["Answer"] };
    expect(publishProblems(expert)).toContain("Add the question a man asked.");
  });
  it("needs a Kiswahili title when there is Kiswahili text", () => {
    const item = { ...blankItem(), id: "walk", title: "Walk", summary: "A short walk helps digestion.", body: ["Walk."], bodySw: ["Tembea."] };
    expect(publishProblems(item)).toContain("Add the Kiswahili title too.");
  });
});
