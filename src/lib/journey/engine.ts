// Step 100: turns his answers (and what he has done since) into today's plan. Pure and deterministic:
// the same inputs always give the same plan, so every rule can be tested. No AI is involved here.
//
// Order of what comes first:
//  1. warning signs (emergency / crisis) — the plan waits until he has got help
//  2. "see a doctor today"
//  3. the review, when it's due
//  4. "book a visit" notes (he can say Later for today)
//  5. his tasks — a few to start, one more each week he stays with it (up to 5), fewer if he asks
// No fixed day-by-day programme: the order depends on what he told us.

import { shiftKey } from "../progress/dates";
import { CONCERN_PRIORITY } from "./concerns";
import { chosenConcerns, list } from "./questions";
import { blocksPlan, bmi, restrictions, safetyCheck } from "./safety";
import { TASKS, type TaskDef } from "./tasks";
import type { Answers, ConcernId, GoalId, JourneyDB, Review, SafetyNote, Txt } from "./types";

/** Bump when the questions change in a way that should ask men to review their answers. */
export const ASSESSMENT_VERSION = 1;
export const REVIEW_EVERY_DAYS = 14;
const START_TASKS = 3;
const MAX_TASKS = 5;
const SMALL_TASKS = 2;

/** All approved tasks that fit him, best first. Leaves out anything his restrictions rule out. */
export function rankTasks(a: Answers): TaskDef[] {
  const concerns = chosenConcerns(a);
  const goals = list(a.goals) as GoalId[];
  const stop = restrictions(a);
  const boost: Record<string, number> = {};
  const add = (id: string, n: number) => (boost[id] = (boost[id] ?? 0) + n);
  // Gaps in his everyday habits
  if (a.move === "0") add("walk", 15);
  if (a.move === "1-2") add("walk", 8);
  if (a.sleep === "<5" || a.sleep === "5-6") {
    add("screens-off", 12);
    add("sleep-log", 8);
  }
  if (a.md_sleep === "start") add("screens-off", 8);
  if (a.stress === "high") add("breathe", 12);
  if (a.food === "rarely") add("veg", 12);
  if (a.food === "some") add("veg", 5);
  if (list(a.dg_signs).includes("constip")) add("fibre", 12);
  if (list(a.dg_signs).some((s) => s === "heartburn" || s === "burn" || s === "bloat" || s === "gas")) add("slow-meals", 6);
  const b = bmi(a);
  if (b !== null && b >= 30) add("walk", 5); // WHO: obesity from a BMI of 30
  // Recently measured blood pressure: no need to ask again
  const bpKnown = a.bp_last === "month";

  const scored = TASKS.filter((x) => !(x.avoid ?? []).some((r) => stop.has(r)))
    .filter((x) => !(x.id === "bp-check" && bpKnown))
    .map((x) => {
      const cHits = x.concerns.filter((c) => concerns.includes(c));
      const gHits = x.goals.filter((g) => goals.includes(g));
      // Areas earlier in the priority list weigh a little more
      const cScore = cHits.reduce((s, c) => s + 20 + (CONCERN_PRIORITY.length - CONCERN_PRIORITY.indexOf(c)), 0);
      const relevant = cHits.length > 0 || gHits.length > 0 || (boost[x.id] ?? 0) > 0;
      return { x, relevant, score: x.priority + cScore + gHits.length * 8 + (boost[x.id] ?? 0) };
    });
  // Nothing chosen at all ("just want to stay strong"): the everyday basics
  const anyRelevant = scored.some((s) => s.relevant);
  return scored
    .filter((s) => s.relevant || (!anyRelevant && ["walk", "veg", "breathe", "checkin", "screens-off"].includes(s.x.id)))
    .sort((p, q) => q.score - p.score || p.x.id.localeCompare(q.x.id))
    .map((s) => s.x);
}

/** How many tasks a day: 3 to start, one more for each 7 days he has been active, at most 5; 2 if he asked for less. */
export function taskCap(activeDaysTotal: number, smaller: boolean): number {
  if (smaller) return SMALL_TASKS;
  return Math.min(MAX_TASKS, START_TASKS + Math.floor(activeDaysTotal / 7));
}

/** Notes from his reviews: getting worse → see someone; no change two reviews running → see someone. */
export function reviewNotes(reviews: Review[]): SafetyNote[] {
  const notes: SafetyNote[] = [];
  const sorted = [...reviews].sort((p, q) => p.at.localeCompare(q.at));
  const last = sorted[sorted.length - 1];
  const before = sorted[sorted.length - 2];
  if (!last) return notes;
  for (const [k, v] of Object.entries(last.answers)) {
    if (k === "overall") continue;
    const c = k as ConcernId;
    if (v === "worse")
      notes.push({
        id: `review-worse-${c}-${last.localDate}`,
        level: "soon",
        concern: c,
        title: { sw: "Hali imekuwa mbaya zaidi", en: "It's got worse" },
        body: {
          sw: "Si kosa lako. Kitu kikizidi, ni wakati wa daktari kukuangalia. Mpango wako unaendelea pembeni.",
          en: "That's not your fault. When something gets worse, it's time for a doctor to take a look. Your plan carries on alongside.",
        },
      });
    if (v === "same" && before?.answers[c] === "same")
      notes.push({
        id: `review-same-${c}-${last.localDate}`,
        level: "soon",
        concern: c,
        title: { sw: "Bado hakuna mabadiliko", en: "Still no change" },
        body: {
          sw: "Wiki nne bila mabadiliko si kushindwa kwako. Mtaalamu wa afya anaweza kuona kitu ambacho mpango huu hauwezi.",
          en: "Four weeks without change isn't you failing. A health worker can spot things this plan can't.",
        },
      });
  }
  return notes;
}

export type Stage = "help" | "check" | "review" | "start" | "build";
export const STAGE_LABEL: Record<Stage, Txt> = {
  help: { sw: "Pata msaada kwanza", en: "Get help first" },
  check: { sw: "Pimwa kwanza", en: "Get checked" },
  review: { sw: "Wakati wa kutathmini", en: "Time to review" },
  start: { sw: "Unaanza", en: "Getting started" },
  build: { sw: "Unajenga tabia", en: "Building habits" },
};

export type Primary =
  | { type: "note"; note: SafetyNote }
  | { type: "review" }
  | { type: "task"; task: TaskDef }
  | { type: "done" };

export interface TodayTask {
  task: TaskDef;
  done: boolean;
}

export interface Plan {
  notes: SafetyNote[];
  /** Notes he hasn't acted on yet. */
  openNotes: SafetyNote[];
  blocked: boolean;
  stage: Stage;
  /** Day 1 = the day he finished the assessment. */
  day: number;
  focus: ConcernId[];
  goals: GoalId[];
  primary: Primary;
  /** Today's tasks (the main one included), in order. */
  tasks: TodayTask[];
  doneToday: number;
  /** Days in the last 14 on which he did at least one plan task. */
  activeDays14: number;
  activeDaysTotal: number;
  reviewOn: string;
  reviewDue: boolean;
}

export interface PlanInput {
  db: JourneyDB;
  today: string;
  /** Did he do this task on this day? (Tasks shared with the Man tab are looked up there.) */
  isDone: (task: TaskDef, day: string) => boolean;
}

/** Is a task done for "today"? A weekly task counts if it was done in the last 7 days. */
export function doneFor(task: TaskDef, today: string, isDone: PlanInput["isDone"], db: JourneyDB): boolean {
  if (task.kind === "once") return Boolean(db.done && Object.values(db.done).some((d) => d[task.id]));
  if (task.kind === "weekly") return Array.from({ length: 7 }, (_, i) => shiftKey(today, -i)).some((d) => isDone(task, d));
  return isDone(task, today);
}

export function buildPlan({ db, today, isDone }: PlanInput): Plan | null {
  const as = db.assessment;
  if (!as) return null;
  const a = as.answers;
  const reviews = db.reviews ?? [];
  const handled = db.handled ?? {};
  const notes = [...safetyCheck(a), ...reviewNotes(reviews)];
  const openNotes = notes.filter((n) => !handled[n.id]);
  const blocked = blocksPlan(openNotes);

  const ranked = rankTasks(a);
  // Active days: any plan-able task done that day (since he started)
  const days: string[] = [];
  for (let d = as.startedOn, i = 0; d <= today && i < 3650; d = shiftKey(d, 1), i++) days.push(d);
  const activeDay = (d: string) => ranked.some((x) => x.kind !== "once" && isDone(x, d));
  const activeDaysTotal = days.filter(activeDay).length;
  const last14 = Array.from({ length: 14 }, (_, i) => shiftKey(today, -i)).filter((d) => d >= as.startedOn);
  const activeDays14 = last14.filter(activeDay).length;

  const cap = taskCap(activeDaysTotal, Boolean(db.smaller?.on));
  const tasks: TodayTask[] = ranked.slice(0, cap).map((task) => ({ task, done: doneFor(task, today, isDone, db) }));
  // A finished one-off task makes room for the next one
  const visible = tasks.filter((x) => !(x.task.kind === "once" && x.done));
  if (visible.length < tasks.length) {
    for (const task of ranked.slice(cap)) {
      if (visible.length >= cap) break;
      const done = doneFor(task, today, isDone, db);
      if (task.kind === "once" && done) continue;
      visible.push({ task, done });
    }
  }

  const lastReview = [...reviews].sort((p, q) => q.localDate.localeCompare(p.localDate))[0];
  const reviewOn = shiftKey(lastReview && lastReview.localDate > as.startedOn ? lastReview.localDate : as.startedOn, REVIEW_EVERY_DAYS);
  const reviewDue = today >= reviewOn;
  const day = days.length;

  const todayNote = openNotes.find((n) => n.level === "today");
  const soonNote = openNotes.find((n) => n.level === "soon" && db.snoozed?.[n.id] !== today);
  const nextTask = visible.find((x) => !x.done)?.task;
  let primary: Primary;
  if (blocked) primary = { type: "note", note: openNotes.find((n) => n.level === "emergency" || n.level === "crisis")! };
  else if (todayNote) primary = { type: "note", note: todayNote };
  else if (reviewDue) primary = { type: "review" };
  else if (soonNote) primary = { type: "note", note: soonNote };
  else if (nextTask) primary = { type: "task", task: nextTask };
  else primary = { type: "done" };

  const stage: Stage = blocked
    ? "help"
    : todayNote || openNotes.some((n) => n.level === "soon")
      ? "check"
      : reviewDue
        ? "review"
        : day <= 7
          ? "start"
          : "build";

  return {
    notes,
    openNotes,
    blocked,
    stage,
    day,
    focus: chosenConcerns(a),
    goals: list(a.goals) as GoalId[],
    primary,
    tasks: visible,
    doneToday: visible.filter((x) => x.done).length,
    activeDays14,
    activeDaysTotal,
    reviewOn,
    reviewDue,
  };
}
