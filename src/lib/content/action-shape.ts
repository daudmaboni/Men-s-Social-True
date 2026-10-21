// Checks a "do this" card that came from the database or from the AI, so a bad value never breaks the feed.
// Pure (no network), used by rows.ts and the Card maker.

import type { ActionResult, ActionSlide, ActionSpec, ActionType, ChallengeId } from "./types";

export const ACTION_TYPES: ActionType[] = ["technique", "position", "mix", "exercise", "food", "habit", "mind"];
export const ACTION_RESULTS: ActionResult[] = ["tonight", "days", "weeks2", "weeks4", "daily"];
export const CHALLENGE_IDS: ChallengeId[] = ["last", "hard", "her", "mixes", "train", "reset", "desire"];

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strs = (v: unknown, max = 300) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean) : []);

/** A clean ActionSpec, or undefined if it can't be shown. */
export function cleanAction(v: unknown): ActionSpec | undefined {
  if (!v || typeof v !== "object") return undefined;
  const a = v as Record<string, unknown>;
  const steps: ActionSlide[] = (Array.isArray(a.steps) ? a.steps : [])
    .slice(0, 12)
    .map((s) => {
      const o = (s ?? {}) as Record<string, unknown>;
      const slide: ActionSlide = { text: str(o.text), textSw: str(o.textSw) };
      const title = str(o.title, 80);
      const titleSw = str(o.titleSw, 80);
      if (title) slide.title = title;
      if (titleSw) slide.titleSw = titleSw;
      return slide;
    })
    .filter((s) => s.text || s.textSw)
    .map((s) => ({ ...s, text: s.text || s.textSw, textSw: s.textSw || s.text }));
  const challenges = strs(a.challenges, 20).filter((c): c is ChallengeId => CHALLENGE_IDS.includes(c as ChallengeId));
  if (!steps.length || !challenges.length) return undefined;
  const type = ACTION_TYPES.includes(a.type as ActionType) ? (a.type as ActionType) : "technique";
  const results = ACTION_RESULTS.includes(a.results as ActionResult) ? (a.results as ActionResult) : "weeks2";
  const need = strs(a.need).slice(0, 10);
  const needSw = strs(a.needSw).slice(0, 10);
  const out: ActionSpec = { type, challenges: [...new Set(challenges)], results, steps };
  if (need.length || needSw.length) {
    const n = Math.max(need.length, needSw.length);
    out.need = Array.from({ length: n }, (_, i) => need[i] || needSw[i]);
    out.needSw = Array.from({ length: n }, (_, i) => needSw[i] || need[i]);
  }
  const why = str(a.why);
  const whySw = str(a.whySw);
  if (why || whySw) {
    out.why = why || whySw;
    out.whySw = whySw || why;
  }
  if (a.tool === "pelvic-floor") out.tool = "pelvic-floor";
  return out;
}

/** The full-page text of a card (same layout as the built-in cards), in English or Kiswahili. */
export function cardBody(a: ActionSpec, sw: boolean): string[] {
  const need = sw ? a.needSw : a.need;
  const why = sw ? a.whySw : a.why;
  return [
    ...(need?.length ? [sw ? "## Mahitaji" : "## You need", ...need.map((n) => `• ${n}`)] : []),
    sw ? "## Fanya hivi" : "## Do this",
    ...a.steps.map((s, i) => {
      const title = sw ? s.titleSw : s.title;
      return `${i + 1}. ${title ? `${title}: ` : ""}${sw ? s.textSw : s.text}`;
    }),
    ...(why ? [sw ? "## Siri yake" : "## The secret", why] : []),
  ];
}
