// Step 100: My Journey — assessment branching, safety rules, plan building and saving across phones.
import { describe, expect, it } from "vitest";
import { CONCERNS } from "./concerns";
import { buildPlan, rankTasks, reviewNotes, taskCap, type PlanInput } from "./engine";
import { answered, complete, questionsFor, tidyAnswers, toggleMany } from "./questions";
import { blocksPlan, bmi, restrictions, safetyCheck } from "./safety";
import { cleanJourney, mergeJourney } from "./store";
import { TASKS, taskById, type TaskDef } from "./tasks";
import type { Answers, JourneyDB } from "./types";
import { shiftKey } from "../progress/dates";
import { CRISIS_REPLY } from "../kito/prompt";

const ids = (a: Answers) => questionsFor(a).map((q) => q.id);
const BASE: Answers = { age: "30-39", goals: ["energy"], concerns: ["nothing"], move: "3-4", sleep: "7-8", food: "yes", stress: "low" };

describe("assessment questions", () => {
  it("asks only the basics when nothing is bothering him", () => {
    expect(ids(BASE)).toEqual(["age", "goals", "concerns", "move", "sleep", "food", "stress"]);
    expect(complete(BASE)).toBe(true);
  });

  it("adds follow-ups only for the areas he picks", () => {
    const q = ids({ ...BASE, concerns: ["erection"] });
    expect(q).toContain("sure_erection");
    expect(q).toContain("ed_red");
    expect(q).not.toContain("hr_red");
    expect(q).not.toContain("treatment");
  });

  it("asks about treatment only when something was confirmed by a doctor", () => {
    expect(ids({ ...BASE, concerns: ["bp"], sure_bp: "suspected" })).not.toContain("treatment");
    expect(ids({ ...BASE, concerns: ["bp"], sure_bp: "diagnosed" })).toContain("treatment");
  });

  it("'I don't know what it is' gets the general warning-sign question", () => {
    expect(ids({ ...BASE, concerns: ["unsure"] })).toContain("gen_red");
  });

  it("asks height and weight only when they matter", () => {
    expect(ids(BASE)).not.toContain("weight");
    expect(ids({ ...BASE, concerns: ["weight"] })).toContain("height");
    expect(ids({ ...BASE, goals: ["fit"] })).toContain("weight");
  });

  it("several areas are asked in safety order, each once", () => {
    const q = ids({ ...BASE, concerns: ["early", "hernia", "mind"] });
    expect(q.indexOf("sure_hernia")).toBeLessThan(q.indexOf("sure_mind"));
    expect(q.indexOf("sure_mind")).toBeLessThan(q.indexOf("sure_early"));
    expect(new Set(q).size).toBe(q.length);
  });

  it("'None of these' clears the others, and the others clear it", () => {
    const q = questionsFor({ ...BASE, concerns: ["hernia"] }).find((x) => x.id === "hr_red")!;
    expect(toggleMany(q, ["stuck"], "none")).toEqual(["none"]);
    expect(toggleMany(q, ["none"], "vomit")).toEqual(["vomit"]);
    expect(toggleMany(q, ["vomit"], "vomit")).toEqual([]);
  });

  it("every warning-sign question can be answered with 'None of these'", () => {
    const all: Answers = { ...BASE, concerns: [...CONCERNS.map((c) => c.id), "unsure"] };
    for (const c of CONCERNS) all[`sure_${c.id}`] = "diagnosed";
    for (const q of questionsFor(all).filter((x) => x.safety && x.kind === "many")) expect(q.options?.some((o) => o.id === "none" && o.only)).toBe(true);
  });

  it("drops answers to questions that are no longer asked", () => {
    const a = tidyAnswers({ ...BASE, concerns: ["early"], sure_hernia: "suspected", hr_red: ["stuck"], sure_early: "signs" });
    expect(a.hr_red).toBeUndefined();
    expect(a.sure_hernia).toBeUndefined();
    expect(a.sure_early).toBe("signs");
  });

  it("checks numbers are in a sensible range", () => {
    const h = questionsFor({ ...BASE, concerns: ["weight"] }).find((q) => q.id === "height")!;
    expect(answered(h, 175)).toBe(true);
    expect(answered(h, 17.5)).toBe(false);
  });

  it("never treats masturbation as a condition", () => {
    const text = JSON.stringify(questionsFor({ ...BASE, concerns: CONCERNS.map((c) => c.id) }));
    expect(text).not.toMatch(/punyeto|masturbat|nyeto|kujichua/i);
  });
});

describe("safety rules", () => {
  const ed = (red: string[]): Answers => ({ ...BASE, concerns: ["erection"], sure_erection: "signs", ed_red: red });

  it("an erection lasting 4+ hours stops the plan and says go now", () => {
    const n = safetyCheck(ed(["long"]));
    expect(n[0].level).toBe("emergency");
    expect(blocksPlan(n)).toBe(true);
  });

  it("hernia warning signs are an emergency", () => {
    for (const s of ["stuck", "vomit", "blocked", "pain"])
      expect(safetyCheck({ ...BASE, concerns: ["hernia"], sure_hernia: "suspected", hr_red: [s] })[0].level).toBe("emergency");
  });

  it("stroke or heart signs with blood pressure are an emergency; a very high reading means a doctor today", () => {
    expect(safetyCheck({ ...BASE, concerns: ["bp"], sure_bp: "diagnosed", bp_red: ["stroke"] })[0].level).toBe("emergency");
    const n = safetyCheck({ ...BASE, concerns: ["bp"], sure_bp: "diagnosed", bp_high: "yes", bp_red: ["none"] });
    expect(n.map((x) => x.level)).toEqual(["today"]);
  });

  it("dangerous blood sugar signs are an emergency", () => {
    expect(safetyCheck({ ...BASE, concerns: ["sugar"], sure_sugar: "diagnosed", sg_red: ["confused"] })[0].level).toBe("emergency");
  });

  it("thoughts of self-harm get Kito's crisis reply, not a plan", () => {
    const n = safetyCheck({ ...BASE, concerns: ["mind"], sure_mind: "signs", md_interest: "0", md_down: "0", md_harm: "yes" });
    expect(n[0]).toMatchObject({ level: "crisis", body: { sw: CRISIS_REPLY.sw, en: CRISIS_REPLY.en } });
    expect(blocksPlan(n)).toBe(true);
  });

  it("a mood screen score of 3+ suggests talking to a professional (screening, not a diagnosis)", () => {
    const a: Answers = { ...BASE, concerns: ["mind"], sure_mind: "signs", md_interest: "2", md_down: "1", md_harm: "no" };
    expect(safetyCheck(a).map((x) => x.id)).toContain("soon-mind");
    expect(safetyCheck({ ...a, md_interest: "1" }).map((x) => x.id)).not.toContain("soon-mind");
  });

  it("back red flags: emergency for numbness / control, today for a fall or fever", () => {
    expect(safetyCheck({ ...BASE, concerns: ["back"], sure_back: "signs", bk_red: ["control"] })[0].level).toBe("emergency");
    expect(safetyCheck({ ...BASE, concerns: ["back"], sure_back: "diagnosed", bk_red: ["fever"] })[0].level).toBe("today");
  });

  it("a suspected condition is something to confirm; a confirmed one isn't sent back to be confirmed", () => {
    expect(safetyCheck({ ...BASE, concerns: ["hernia"], sure_hernia: "suspected", hr_red: ["none"] }).map((x) => x.id)).toEqual(["soon-hernia"]);
    expect(safetyCheck({ ...BASE, concerns: ["hernia"], sure_hernia: "diagnosed", hr_red: ["none"] })).toEqual([]);
  });

  it("never tells him he has a condition", () => {
    const all: Answers = { ...BASE, concerns: [...CONCERNS.map((c) => c.id), "unsure"], dg_signs: ["burn"], sg_signs: ["thirst"], md_interest: "3", md_down: "3" };
    for (const c of CONCERNS) all[`sure_${c.id}`] = "suspected";
    const text = JSON.stringify(safetyCheck(all)).toLowerCase();
    expect(text).not.toMatch(/you have (a |an )?(hernia|ulcer|diabetes|depression|erectile)/);
    expect(text).not.toMatch(/una (ngiri|kisukari|vidonda)/);
  });

  it("no notes when nothing worrying was ticked", () => {
    expect(safetyCheck(BASE)).toEqual([]);
  });

  it("a hernia or back problem leaves out straining exercises", () => {
    expect(restrictions({ ...BASE, concerns: ["hernia"] }).has("no-strain")).toBe(true);
    expect(rankTasks({ ...BASE, concerns: ["hernia", "weight"], goals: ["fit"] }).map((x) => x.id)).not.toContain("squats");
    expect(rankTasks({ ...BASE, concerns: ["weight"], goals: ["fit"] }).map((x) => x.id)).toContain("squats");
  });

  it("works out BMI only when both numbers are given", () => {
    expect(bmi({ height: 180, weight: 81 })).toBe(25);
    expect(bmi({ height: 180 })).toBeNull();
  });
});

describe("approved tasks", () => {
  it("never suggest a medicine, supplement or herb", () => {
    for (const x of TASKS) {
      const text = JSON.stringify([x.title, x.how, x.why]).toLowerCase();
      expect(text).not.toMatch(/supplement|herb|mitishamba|virutubisho|vidonge|tablet|capsule|dawa/);
    }
  });

  it("tasks shared with the Man tab use its real activity ids", async () => {
    const { ACTIVITIES } = await import("../feed/catalog");
    for (const x of TASKS.filter((t) => t.activity)) expect(ACTIVITIES.map((a) => a.id)).toContain(x.activity);
  });

  it("linked Discover cards exist", async () => {
    const { LIBRARY } = await import("../content/library");
    for (const x of TASKS.filter((t) => t.card)) expect(LIBRARY.map((c) => c.id)).toContain(x.card);
  });
});

describe("the plan", () => {
  const TODAY = "2026-10-28";
  const db = (a: Answers, extra: Partial<JourneyDB> = {}): JourneyDB => ({
    assessment: { answers: a, at: "2026-10-28T08:00:00.000Z", version: 1, startedOn: TODAY },
    ...extra,
  });
  const none: PlanInput["isDone"] = () => false;
  const PE: Answers = { ...BASE, goals: ["bedroom"], concerns: ["early"], sure_early: "signs", pe_since: "always", pe_red: ["none"] };

  it("no plan before the assessment", () => {
    expect(buildPlan({ db: {}, today: TODAY, isDone: none })).toBeNull();
  });

  it("starts small: three tasks, and the main action is the first one", () => {
    const p = buildPlan({ db: db(PE), today: TODAY, isDone: none })!;
    expect(p.tasks).toHaveLength(3);
    expect(p.primary).toEqual({ type: "task", task: p.tasks[0].task });
    expect(p.stage).toBe("start");
    expect(p.tasks.map((x) => x.task.id)).toContain("kegel");
  });

  it("is the same every time for the same answers", () => {
    const a = buildPlan({ db: db(PE), today: TODAY, isDone: none })!;
    const b = buildPlan({ db: db(PE), today: TODAY, isDone: none })!;
    expect(a).toEqual(b);
  });

  it("adds a task for each week he stays active, up to five; two if he asks for less", () => {
    expect(taskCap(0, false)).toBe(3);
    expect(taskCap(7, false)).toBe(4);
    expect(taskCap(40, false)).toBe(5);
    expect(taskCap(40, true)).toBe(2);
    const p = buildPlan({ db: db(PE, { smaller: { on: true, at: "x" } }), today: TODAY, isDone: none })!;
    expect(p.tasks).toHaveLength(2);
  });

  it("counts real activity, not app opens", () => {
    const start = "2026-10-01";
    const d: JourneyDB = { ...db(PE), assessment: { ...db(PE).assessment!, startedOn: start } };
    const doneDays = new Set(["2026-10-20", "2026-10-25", "2026-10-27"]);
    const p = buildPlan({ db: d, today: TODAY, isDone: (t, day) => t.id === "kegel" && doneDays.has(day) })!;
    expect(p.activeDays14).toBe(3);
    expect(p.activeDaysTotal).toBe(3);
  });

  it("warning signs come first and hold the tasks back", () => {
    const p = buildPlan({ db: db({ ...BASE, concerns: ["hernia"], sure_hernia: "suspected", hr_red: ["stuck"] }), today: TODAY, isDone: none })!;
    expect(p.blocked).toBe(true);
    expect(p.stage).toBe("help");
    expect(p.primary).toMatchObject({ type: "note", note: { level: "emergency" } });
  });

  it("once he has had help, the plan goes on", () => {
    const a: Answers = { ...BASE, concerns: ["hernia"], sure_hernia: "suspected", hr_red: ["stuck"] };
    const p = buildPlan({ db: db(a, { handled: { "em-hernia": "t", "soon-hernia": "t" } }), today: TODAY, isDone: none })!;
    expect(p.blocked).toBe(false);
    expect(p.primary.type).toBe("task");
  });

  it("'book a visit' is the main action until he books it or says later for today", () => {
    const a: Answers = { ...BASE, concerns: ["hernia"], sure_hernia: "suspected", hr_red: ["none"] };
    expect(buildPlan({ db: db(a), today: TODAY, isDone: none })!.primary).toMatchObject({ type: "note", note: { id: "soon-hernia" } });
    const later = buildPlan({ db: db(a, { snoozed: { "soon-hernia": TODAY } }), today: TODAY, isDone: none })!;
    expect(later.primary.type).toBe("task");
    expect(later.stage).toBe("check");
    const tomorrow = buildPlan({ db: db(a, { snoozed: { "soon-hernia": TODAY } }), today: shiftKey(TODAY, 1), isDone: none })!;
    expect(tomorrow.primary.type).toBe("note");
  });

  it("the review comes after two weeks, before 'book a visit' notes", () => {
    const p = buildPlan({ db: db(PE), today: shiftKey(TODAY, 14), isDone: none })!;
    expect(p.reviewDue).toBe(true);
    expect(p.primary).toEqual({ type: "review" });
    const after = buildPlan({ db: db(PE, { reviews: [{ at: "r", localDate: shiftKey(TODAY, 14), answers: { early: "better" } }] }), today: shiftKey(TODAY, 15), isDone: none })!;
    expect(after.reviewDue).toBe(false);
    expect(after.reviewOn).toBe(shiftKey(TODAY, 28));
  });

  it("worse, or no change twice, points to a professional without blaming him", () => {
    expect(reviewNotes([{ at: "1", localDate: "2026-11-11", answers: { early: "worse" } }])[0]).toMatchObject({ level: "soon", concern: "early" });
    expect(reviewNotes([{ at: "1", localDate: "2026-11-11", answers: { early: "same" } }])).toEqual([]);
    expect(reviewNotes([
      { at: "1", localDate: "2026-11-11", answers: { early: "same" } },
      { at: "2", localDate: "2026-11-25", answers: { early: "same" } },
    ])).toHaveLength(1);
  });

  it("a weekly task done this week counts as done today", () => {
    const p = buildPlan({ db: db(PE), today: TODAY, isDone: (t, day) => t.id === "stop-start" && day === shiftKey(TODAY, -3) })!;
    const ss = p.tasks.find((x) => x.task.id === "stop-start");
    expect(ss?.done).toBe(true);
  });

  it("a finished one-off task makes room for the next", () => {
    const a: Answers = { ...BASE, concerns: ["bp"], sure_bp: "diagnosed", treatment: "yes", bp_last: "older", bp_high: "no", bp_red: ["none"] };
    const first = buildPlan({ db: db(a), today: TODAY, isDone: none })!;
    expect(first.tasks.map((x) => x.task.id)).toContain("bp-check");
    const after = buildPlan({ db: db(a, { done: { [TODAY]: { "bp-check": "t" } } }), today: TODAY, isDone: none })!;
    expect(after.tasks.map((x) => x.task.id)).not.toContain("bp-check");
    expect(after.tasks).toHaveLength(3);
  });

  it("all done today → nothing nagging", () => {
    const p = buildPlan({ db: db(PE), today: TODAY, isDone: () => true })!;
    expect(p.primary).toEqual({ type: "done" });
    expect(p.doneToday).toBe(p.tasks.length);
  });

  it("nothing bothering him: the everyday basics", () => {
    const p = buildPlan({ db: db({ ...BASE, goals: [] }), today: TODAY, isDone: none })!;
    expect(p.tasks.length).toBe(3);
    const isBasic = (x: TaskDef) => ["walk", "veg", "breathe", "checkin", "screens-off"].includes(x.id);
    expect(p.tasks.every((x) => isBasic(x.task))).toBe(true);
  });
});

describe("saving across phones", () => {
  const A = (at: string, startedOn = "2026-10-01"): JourneyDB["assessment"] => ({ answers: { ...BASE }, at, version: 1, startedOn });

  it("the newest assessment wins", () => {
    const m = mergeJourney({ assessment: A("2026-10-02") }, { assessment: A("2026-10-05") });
    expect(m.assessment?.at).toBe("2026-10-05");
  });

  it("starting over on one phone isn't undone by the other", () => {
    const m = mergeJourney(
      { deleted: { assessment: "2026-10-10T00:00:00.000Z" } },
      { assessment: A("2026-10-05T00:00:00.000Z"), done: { "2026-10-06": { kegel: "2026-10-06T07:00:00.000Z" } } },
      new Date("2026-10-11"),
    );
    expect(m.assessment).toBeUndefined();
    expect(m.done).toEqual({});
  });

  it("a new assessment after starting over is kept", () => {
    const m = mergeJourney({ assessment: A("2026-10-12T00:00:00.000Z", "2026-10-12"), deleted: {} }, { deleted: { assessment: "2026-10-10T00:00:00.000Z" } }, new Date("2026-10-13"));
    expect(m.assessment?.startedOn).toBe("2026-10-12");
  });

  it("ticks from both phones count; an untick after the tick removes it", () => {
    const m = mergeJourney(
      { done: { d1: { kegel: "2026-10-06T07:00:00.000Z" } } },
      { done: { d1: { veg: "2026-10-06T09:00:00.000Z" }, d2: { kegel: "2026-10-07T07:00:00.000Z" } }, deleted: { "done:d2:kegel": "2026-10-07T08:00:00.000Z" } },
      new Date("2026-10-08"),
    );
    expect(m.done).toEqual({ d1: { kegel: "2026-10-06T07:00:00.000Z", veg: "2026-10-06T09:00:00.000Z" } });
  });

  it("keeps reviews and handled notes from both", () => {
    const m = mergeJourney(
      { reviews: [{ at: "2026-10-15T00:00:00.000Z", localDate: "2026-10-15", answers: {} }], handled: { x: "2026-10-03" } },
      { reviews: [{ at: "2026-10-29T00:00:00.000Z", localDate: "2026-10-29", answers: {} }], handled: { y: "2026-10-04" } },
    );
    expect(m.reviews).toHaveLength(2);
    expect(Object.keys(m.handled ?? {}).sort()).toEqual(["x", "y"]);
  });

  it("a broken saved copy doesn't crash", () => {
    expect(cleanJourney(JSON.parse('{"assessment":{"answers":null},"done":[1],"reviews":"x"}'))).toEqual({ done: {}, handled: {}, snoozed: {}, reviews: [], deleted: {} });
    expect(taskById("kegel")?.kind).toBe("daily");
  });
});
