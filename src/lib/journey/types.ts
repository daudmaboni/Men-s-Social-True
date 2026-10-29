// Step 100: My Journey — the shapes shared by the assessment, the rules and the plan.
// Content is written Kiswahili first, with the English beside it (sw / en), like the Discover cards.

import type { Tombstones } from "../account/tombstones";

export type JLang = "sw" | "en";
export interface Txt {
  sw: string;
  en: string;
}
export const say = (t: Txt, lang: JLang) => (lang === "sw" ? t.sw : t.en);

/** What he can tell us is bothering him. These are areas to look at, never diagnoses the app makes. */
export type ConcernId = "erection" | "early" | "hernia" | "digestion" | "bp" | "sugar" | "mind" | "weight" | "back";

/** What he wants out of it. */
export type GoalId = "energy" | "bedroom" | "sleep" | "fit" | "calm" | "stomach" | "condition";

/**
 * How sure he is about a concern:
 *  diagnosed — a doctor or health worker confirmed it
 *  suspected — he thinks he may have it
 *  signs     — he only has some signs, no idea what it is
 */
export type Certainty = "diagnosed" | "suspected" | "signs";

/** His answers, by question id. One choice = string, several = string[], a number = number. */
export type Answers = Record<string, string | string[] | number | undefined>;

/** Things that change which exercises are safe for him. */
export type Restriction = "no-strain" | "gentle" | "meds-exercise";

/** How quickly he should get help. */
export type Level = "emergency" | "crisis" | "today" | "soon";

export interface SafetyNote {
  id: string;
  level: Level;
  concern?: ConcernId;
  title: Txt;
  body: Txt;
  /** Where the advice comes from (for him, and for the clinician who reviews the rules). */
  source?: string;
}

/** How an area is going, asked at each review. */
export type ReviewAnswer = "better" | "same" | "worse" | "unsure";
export interface Review {
  at: string;
  localDate: string;
  answers: Partial<Record<ConcernId | "overall", ReviewAnswer>>;
}

/** Everything My Journey saves (on the phone, and in his account as user_data kind "journey"). */
export interface JourneyDB {
  /** His latest assessment. Redoing it replaces this (the plan follows); what he did is kept. */
  assessment?: { answers: Answers; at: string; version: number; startedOn: string };
  /** Plan tasks of his own that he ticked: done["2026-10-28"]["kegel"] = when. */
  done?: Record<string, Record<string, string>>;
  /** Safety notes he acted on ("I've booked / been seen"): handled["soon-hernia"] = when. */
  handled?: Record<string, string>;
  /** "Later" on a note: not the main action again until the next day. snoozed["soon-hernia"] = day key. */
  snoozed?: Record<string, string>;
  reviews?: Review[];
  /** He asked for a smaller plan (fewer tasks a day). The side changed last wins. */
  smaller?: { on: boolean; at: string };
  deleted?: Tombstones;
}
