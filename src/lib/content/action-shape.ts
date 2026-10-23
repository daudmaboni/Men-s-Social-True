// Checks a "do this" card that came from the database or from the AI, so a bad value never breaks the feed.
// Pure (no network), used by rows.ts and the Card maker.

import type { ActionResult, ActionSlide, ActionSpec, ActionType, CardAsk, CardSeries, ChallengeDays, ChallengeId } from "./types";

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
  const ask = cleanAsk(a.ask);
  if (ask) out.ask = ask;
  const series = cleanSeries(a.series);
  if (series) out.series = series;
  if (CHALLENGE_DAYS.includes(Number(a.challengeDays) as ChallengeDays)) out.challengeDays = Number(a.challengeDays) as ChallengeDays;
  const shareTitle = str(a.shareTitle, 90);
  const shareTitleSw = str(a.shareTitleSw, 90);
  if (shareTitle || shareTitleSw) {
    out.shareTitle = shareTitle || shareTitleSw;
    out.shareTitleSw = shareTitleSw || shareTitle;
  }
  return out;
}

/* ───────── Step 86: hooks ───────── */
export const CHALLENGE_DAYS: ChallengeDays[] = [3, 5, 7];

/** A series id from its English name: "5 nights to last longer" → "5-nights-to-last-longer". */
export const seriesId = (name: string) =>
  name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export function cleanAsk(v: unknown): CardAsk | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const q = str(o.q, 200) || str(o.qSw, 200);
  const qSw = str(o.qSw, 200) || q;
  const a = str(o.a, 400) || str(o.aSw, 400);
  const aSw = str(o.aSw, 400) || a;
  if (!q || !a) return undefined;
  const kind = o.kind === "truefalse" ? "truefalse" : "question";
  return kind === "truefalse" ? { kind, q, qSw, a, aSw, truth: o.truth === true } : { kind, q, qSw, a, aSw };
}

export function cleanSeries(v: unknown): CardSeries | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const name = str(o.name, 80) || str(o.nameSw, 80);
  const nameSw = str(o.nameSw, 80) || name;
  const part = Math.round(Number(o.part));
  if (!name || !Number.isFinite(part) || part < 1 || part > 30) return undefined;
  const id = seriesId(str(o.id, 60) || name) || seriesId(name);
  if (!id) return undefined;
  const out: CardSeries = { id, name, nameSw, part };
  const tease = str(o.tease, 140);
  const teaseSw = str(o.teaseSw, 140);
  if (tease || teaseSw) {
    out.tease = tease || teaseSw;
    out.teaseSw = teaseSw || tease;
  }
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
