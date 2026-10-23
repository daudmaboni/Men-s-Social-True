// "Did it help?" (Step 79): a few days after he tapped "I did it" on a Discover card, one card asks him.
// - Asked about one card at a time, 3 to 30 days after he did it, newest first; never twice.
// - "Yes" counts like "Useful" for his feed (more cards for that challenge); every answer is counted for the
//   Studio without saying who (track_content helped_yes / helped_some / helped_no).
// - No points for the answer (points are for doing, never for saying something worked).

import type { HelpedAnswer, TriedEntry } from "../feed/store";

export const ASK_AFTER_DAYS = 3;
export const ASK_UNTIL_DAYS = 30;
const DAY = 86_400_000;

/** The card to ask about now, if any. */
export function dueHelpedCheck(tried: Record<string, TriedEntry> | undefined, now: Date = new Date()): string | null {
  const t = now.getTime();
  let best: { id: string; at: number } | null = null;
  for (const [id, x] of Object.entries(tried ?? {})) {
    if (!x || x.helped) continue;
    const at = Date.parse(x.at);
    if (Number.isNaN(at) || t - at < ASK_AFTER_DAYS * DAY || t - at > ASK_UNTIL_DAYS * DAY) continue;
    if (!best || at > best.at) best = { id, at };
  }
  return best?.id ?? null;
}

/** Cards he said helped, shaped like "Useful" marks (id → when), for the feed order. */
export function helpedYes(tried: Record<string, TriedEntry> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, x] of Object.entries(tried ?? {})) if (x?.helped?.answer === "yes") out[id] = x.helped.at;
  return out;
}

export const HELPED_EVENT: Record<Exclude<HelpedAnswer, "skip">, "helped_yes" | "helped_some" | "helped_no"> = {
  yes: "helped_yes",
  some: "helped_some",
  no: "helped_no",
};
