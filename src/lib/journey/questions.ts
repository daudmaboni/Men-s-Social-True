// Step 100: the assessment. A few questions for everyone, then follow-ups only for what he chose.
// questionsFor(answers) is pure: the same answers always give the same list (tested in step100.test.ts).
// Warning-sign questions always have "None of these", so he never has to tick something to get past.

import { CERTAINTY_EXPLAINED, CONCERNS, CONCERN_PRIORITY, GOALS } from "./concerns";
import type { Answers, ConcernId, Txt } from "./types";

export interface Option {
  id: string;
  label: Txt;
  /** Picking this clears the others (e.g. "None of these"). */
  only?: boolean;
}

export interface Question {
  id: string;
  kind: "one" | "many" | "number";
  title: Txt;
  help?: Txt;
  options?: Option[];
  /** He can skip it. */
  optional?: boolean;
  /** For numbers. */
  unit?: string;
  min?: number;
  max?: number;
  /** Show the "what do these mean?" explanation of diagnosed / think so / signs. */
  explain?: "certainty";
  /** A warning-sign question: answering anything but "none" may stop the plan and point to help. */
  safety?: boolean;
}

const o = (id: string, sw: string, en: string, only?: boolean): Option => ({ id, label: { sw, en }, ...(only ? { only } : {}) });
const NONE = o("none", "Hakuna kati ya haya", "None of these", true);

/** Ages are ranges: enough to tailor the plan, without asking his birthday. */
export const AGE: Question = {
  id: "age",
  kind: "one",
  title: { sw: "Una umri gani?", en: "How old are you?" },
  options: [o("18-29", "18–29", "18–29"), o("30-39", "30–39", "30–39"), o("40-49", "40–49", "40–49"), o("50-59", "50–59", "50–59"), o("60+", "60 au zaidi", "60 or older")],
};

export const GOALS_Q: Question = {
  id: "goals",
  kind: "many",
  title: { sw: "Unataka nini zaidi?", en: "What do you want most?" },
  help: { sw: "Chagua yoyote unayotaka.", en: "Pick as many as you like." },
  options: GOALS.map((g) => ({ id: g.id, label: g.label })),
};

export const CONCERNS_Q: Question = {
  id: "concerns",
  kind: "many",
  title: { sw: "Kuna kitu kinachokusumbua?", en: "Is anything bothering you?" },
  help: { sw: "Ni siri yako. Chagua vyote vinavyokuhusu.", en: "This stays private. Pick everything that applies." },
  options: [
    ...CONCERNS.map((c) => ({ id: c.id, label: c.name })),
    o("unsure", "Kuna tatizo, ila sijui ni nini", "Something's wrong, but I don't know what"),
    o("nothing", "Hakuna, nataka tu kuwa imara", "Nothing, I just want to stay strong", true),
  ],
};

const sure = (c: ConcernId): Question => {
  const name = CONCERNS.find((x) => x.id === c)!.name;
  return {
    id: `sure_${c}`,
    kind: "one",
    title: { sw: `${name.sw}: daktari amethibitisha?`, en: `${name.en}: has a doctor confirmed it?` },
    options: CERTAINTY_EXPLAINED.map((x) => ({ id: x.id, label: x.label })),
    explain: "certainty",
  };
};

/** Follow-up questions for each area, asked right after "has a doctor confirmed it?". */
const FOLLOW_UPS: Record<ConcernId, Question[]> = {
  erection: [
    {
      id: "ed_how",
      kind: "one",
      title: { sw: "Inatokea mara ngapi?", en: "How often does it happen?" },
      options: [o("some", "Mara moja moja", "Now and then"), o("most", "Mara nyingi", "Most times"), o("always", "Kila mara", "Every time")],
    },
    {
      id: "ed_morning",
      kind: "one",
      title: { sw: "Bado unaamka na uume umesimama asubuhi?", en: "Do you still wake up with morning erections?" },
      help: {
        sw: "Kama bado zipo, mara nyingi mishipa na mwili vinafanya kazi, na stress au uchovu vinachangia.",
        en: "If they still happen, the body's wiring usually works, and stress or tiredness may play a part.",
      },
      options: [o("yes", "Ndiyo", "Yes"), o("some", "Mara chache", "Sometimes"), o("no", "Hapana", "No"), o("unsure", "Sijui", "Not sure")],
    },
    {
      id: "ed_red",
      kind: "many",
      safety: true,
      title: { sw: "Je, kuna mojawapo ya haya sasa hivi?", en: "Is any of this happening to you?" },
      options: [
        o("long", "Uume umesimama saa 4 au zaidi na haulali, sasa hivi", "An erection that has lasted 4 hours or more and won't go down, right now"),
        o("injury", "Maumivu makali, uume kupinda ghafla au kuvimba baada ya tendo au ajali", "Sharp pain, a sudden bend or swelling of the penis after sex or an accident"),
        o("chest", "Kifua kuuma au kukosa pumzi ukifanya kazi ngumu", "Chest pain or breathlessness when you exert yourself"),
        NONE,
      ],
    },
  ],
  early: [
    {
      id: "pe_since",
      kind: "one",
      title: { sw: "Imekuwa hivi tangu lini?", en: "Since when?" },
      options: [o("always", "Tangu mwanzo", "Since I started having sex"), o("new", "Imeanza siku za karibuni", "It started recently")],
    },
    {
      id: "pe_red",
      kind: "many",
      safety: true,
      title: { sw: "Unaona mojawapo ya haya?", en: "Do you notice any of these?" },
      options: [o("pain", "Maumivu wakati wa kumwaga", "Pain when you finish"), o("blood", "Damu kwenye shahawa au mkojo", "Blood in semen or urine"), NONE],
    },
  ],
  hernia: [
    {
      id: "hr_where",
      kind: "one",
      title: { sw: "Uvimbe uko wapi?", en: "Where is the bulge?" },
      options: [o("groin", "Kinena", "Groin"), o("belly", "Tumboni au kitovuni", "Belly or belly button"), o("scrotum", "Kwenye korodani", "In the scrotum"), o("none", "Sioni uvimbe kwa sasa", "I can't see one now")],
    },
    {
      id: "hr_red",
      kind: "many",
      safety: true,
      title: { sw: "Je, kuna mojawapo ya haya sasa hivi?", en: "Is any of this happening now?" },
      options: [
        o("stuck", "Uvimbe mgumu, unauma, na haurudi ndani", "The bulge is hard, painful and won't go back in"),
        o("vomit", "Kutapika au kichefuchefu", "Vomiting or feeling sick"),
        o("blocked", "Huwezi kujisaidia wala kutoa gesi", "You can't poo or pass wind"),
        o("pain", "Maumivu makali ya ghafla", "Sudden, severe pain"),
        NONE,
      ],
    },
  ],
  digestion: [
    {
      id: "dg_signs",
      kind: "many",
      title: { sw: "Nini kinakusumbua zaidi?", en: "What bothers you most?" },
      options: [
        o("gas", "Gesi", "Gas"),
        o("bloat", "Tumbo kujaa", "Bloating"),
        o("burn", "Maumivu ya kuungua juu ya tumbo", "Burning pain in the upper belly"),
        o("heartburn", "Kiungulia", "Heartburn"),
        o("constip", "Kupata choo kwa shida", "Hard or rare stools"),
      ],
    },
    {
      id: "dg_red",
      kind: "many",
      safety: true,
      title: { sw: "Umeona mojawapo ya haya?", en: "Have you noticed any of these?" },
      options: [
        o("vomit_blood", "Kutapika damu au kitu kama kahawa", "Vomiting blood or something like coffee grounds"),
        o("black", "Kinyesi cheusi kama lami", "Black, sticky stools"),
        o("blood_stool", "Damu kwenye kinyesi", "Blood in your stool"),
        o("severe", "Maumivu makali ya ghafla tumboni", "Sudden, severe belly pain"),
        o("weight", "Kupungua uzito bila kujaribu", "Losing weight without trying"),
        o("swallow", "Kumeza chakula kwa shida", "Difficulty swallowing"),
        NONE,
      ],
    },
    {
      id: "dg_meds",
      kind: "one",
      title: { sw: "Unatumia dawa za maumivu kama diclofenac, ibuprofen au aspirin mara kwa mara?", en: "Do you often take painkillers like diclofenac, ibuprofen or aspirin?" },
      options: [o("often", "Ndiyo, mara kwa mara", "Yes, often"), o("some", "Mara moja moja", "Now and then"), o("no", "Hapana", "No")],
    },
  ],
  bp: [
    {
      id: "bp_last",
      kind: "one",
      title: { sw: "Ulipima presha lini mara ya mwisho?", en: "When was your blood pressure last measured?" },
      options: [o("month", "Mwezi huu", "This month"), o("year", "Mwaka huu", "This year"), o("older", "Zaidi ya mwaka", "Over a year ago"), o("never", "Sijawahi", "Never")],
    },
    {
      id: "bp_high",
      kind: "one",
      optional: true,
      title: { sw: "Kipimo cha mwisho kilikuwa 180/120 au zaidi?", en: "Was your last reading 180/120 or higher?" },
      options: [o("yes", "Ndiyo", "Yes"), o("no", "Hapana", "No"), o("unknown", "Sijui", "I don't know")],
    },
    {
      id: "bp_red",
      kind: "many",
      safety: true,
      title: { sw: "Je, una mojawapo ya haya sasa hivi?", en: "Do you have any of these right now?" },
      options: [
        o("headache", "Kichwa kuuma sana ghafla", "A sudden, severe headache"),
        o("chest", "Maumivu au kubanwa kifua", "Chest pain or tightness"),
        o("breath", "Kupumua kwa shida", "Trouble breathing"),
        o("stroke", "Ganzi au udhaifu upande mmoja, uso kulegea au kuongea kwa shida", "Numbness or weakness on one side, a drooping face or trouble speaking"),
        o("vision", "Kuona kwa shida ghafla", "Sudden trouble seeing"),
        NONE,
      ],
    },
  ],
  sugar: [
    {
      id: "sg_signs",
      kind: "many",
      title: { sw: "Unaona mojawapo ya haya?", en: "Do you notice any of these?" },
      options: [
        o("thirst", "Kiu kali", "Strong thirst"),
        o("pee", "Kukojoa mara kwa mara, hata usiku", "Peeing often, even at night"),
        o("weight", "Kupungua uzito bila kujaribu", "Losing weight without trying"),
        o("blur", "Kuona ukungu", "Blurred vision"),
        o("wounds", "Vidonda kuchelewa kupona", "Cuts that heal slowly"),
        NONE,
      ],
    },
    {
      id: "sg_meds",
      kind: "one",
      title: { sw: "Unatumia dawa ya sukari?", en: "Do you take medicine for blood sugar?" },
      options: [o("insulin", "Insulini", "Insulin"), o("tablets", "Vidonge", "Tablets"), o("none", "Hapana", "No")],
    },
    {
      id: "sg_red",
      kind: "many",
      safety: true,
      title: { sw: "Je, kuna mojawapo ya haya sasa hivi?", en: "Is any of this happening right now?" },
      options: [
        o("confused", "Kuchanganyikiwa au kusinzia sana", "Confusion or very strong drowsiness"),
        o("vomit", "Kutapika na kushindwa kunywa", "Vomiting and can't keep drinks down"),
        o("breath", "Kupumua haraka, pumzi yenye harufu kama matunda", "Fast breathing, breath that smells fruity"),
        o("shaky", "Kutetemeka, jasho jingi na kizunguzungu ukiwa kwenye dawa ya sukari", "Shaking, sweating and dizzy while on sugar medicine"),
        NONE,
      ],
    },
  ],
  mind: [
    {
      id: "md_interest",
      kind: "one",
      title: { sw: "Wiki mbili zilizopita, umekosa hamu au furaha ya kufanya mambo?", en: "In the last two weeks, have you had little interest or pleasure in doing things?" },
      options: [o("0", "Hapana kabisa", "Not at all"), o("1", "Siku kadhaa", "Several days"), o("2", "Zaidi ya nusu ya siku", "More than half the days"), o("3", "Karibu kila siku", "Nearly every day")],
    },
    {
      id: "md_down",
      kind: "one",
      title: { sw: "Na umejisikia huzuni au kukata tamaa?", en: "And have you felt down or hopeless?" },
      options: [o("0", "Hapana kabisa", "Not at all"), o("1", "Siku kadhaa", "Several days"), o("2", "Zaidi ya nusu ya siku", "More than half the days"), o("3", "Karibu kila siku", "Nearly every day")],
    },
    {
      id: "md_harm",
      kind: "one",
      optional: true,
      safety: true,
      title: { sw: "Umewahi kuwaza kujidhuru, au kwamba ingekuwa bora usingekuwepo?", en: "Have you had thoughts of hurting yourself, or that you'd be better off not here?" },
      help: { sw: "Jibu la kweli linatusaidia kukuonyesha msaada sahihi.", en: "An honest answer helps us show you the right support." },
      options: [o("no", "Hapana", "No"), o("yes", "Ndiyo", "Yes")],
    },
    {
      id: "md_sleep",
      kind: "one",
      title: { sw: "Usingizi wako ukoje?", en: "How is your sleep?" },
      options: [
        o("ok", "Nalala vizuri", "I sleep well"),
        o("start", "Nachelewa kupata usingizi", "It takes long to fall asleep"),
        o("wake", "Naamka usiku mara nyingi", "I wake up a lot at night"),
        o("early", "Naamka mapema mno", "I wake up too early"),
      ],
    },
  ],
  weight: [],
  back: [
    {
      id: "bk_kind",
      kind: "one",
      title: { sw: "Ni nini hasa?", en: "What is it mainly?" },
      options: [o("pain", "Maumivu ya mgongo", "Back pain"), o("scoliosis", "Scoliosis (mgongo kupinda)", "Scoliosis (curved spine)"), o("stiff", "Kutembea au kujikunja kwa shida", "Stiffness or trouble moving")],
    },
    {
      id: "bk_red",
      kind: "many",
      safety: true,
      title: { sw: "Je, kuna mojawapo ya haya?", en: "Do you have any of these?" },
      options: [
        o("numb", "Ganzi sehemu za siri au makalio", "Numbness around your genitals or buttocks"),
        o("control", "Kushindwa kuzuia mkojo au kinyesi", "Losing control of pee or poo"),
        o("legs", "Miguu yote miwili kulegea au kufa ganzi", "Weakness or numbness in both legs"),
        o("fall", "Maumivu yalianza baada ya kuanguka au ajali", "The pain started after a fall or accident"),
        o("fever", "Homa pamoja na maumivu ya mgongo", "A fever with the back pain"),
        NONE,
      ],
    },
  ],
};

/** For "Something's wrong, but I don't know what". */
const UNSURE_RED: Question = {
  id: "gen_red",
  kind: "many",
  safety: true,
  title: { sw: "Je, una mojawapo ya haya sasa hivi?", en: "Do you have any of these right now?" },
  options: [
    o("chest", "Maumivu au kubanwa kifua", "Chest pain or tightness"),
    o("breath", "Kupumua kwa shida sana", "Serious trouble breathing"),
    o("faint", "Kuzimia au karibu kuzimia", "Fainting or nearly fainting"),
    o("stroke", "Udhaifu ghafla upande mmoja wa mwili au kuongea kwa shida", "Sudden weakness on one side or trouble speaking"),
    o("blood", "Damu kwenye mkojo, kinyesi au matapishi", "Blood in your pee, poo or vomit"),
    NONE,
  ],
};

const TREATMENT: Question = {
  id: "treatment",
  kind: "one",
  optional: true,
  title: { sw: "Unapata tiba au dawa kwa hali uliyothibitishiwa?", en: "Are you getting treatment or medicine for what was confirmed?" },
  help: {
    sw: "Endelea na tiba yako kama ulivyoelekezwa. Mpango huu unaenda pamoja nayo, hauichukui nafasi.",
    en: "Keep taking your treatment as you were told. This plan goes alongside it, it doesn't replace it.",
  },
  options: [o("yes", "Ndiyo", "Yes"), o("no", "Hapana", "No")],
};

const LIFESTYLE: Question[] = [
  {
    id: "move",
    kind: "one",
    title: { sw: "Kwa wiki, siku ngapi unatembea au kufanya mazoezi kwa dakika 30?", en: "How many days a week do you walk or exercise for 30 minutes?" },
    options: [o("0", "Hakuna", "None"), o("1-2", "1–2", "1–2"), o("3-4", "3–4", "3–4"), o("5+", "5 au zaidi", "5 or more")],
  },
  {
    id: "sleep",
    kind: "one",
    title: { sw: "Kwa kawaida unalala saa ngapi usiku?", en: "How many hours do you usually sleep?" },
    options: [o("<5", "Chini ya 5", "Under 5"), o("5-6", "5–6", "5–6"), o("7-8", "7–8", "7–8"), o("9+", "9 au zaidi", "9 or more")],
  },
  {
    id: "food",
    kind: "one",
    title: { sw: "Unakula mboga au matunda kila siku?", en: "Do you eat vegetables or fruit every day?" },
    options: [o("yes", "Ndiyo", "Yes"), o("some", "Mara nyingine", "Sometimes"), o("rarely", "Mara chache", "Rarely")],
  },
  {
    id: "stress",
    kind: "one",
    title: { sw: "Stress yako siku hizi iko kiasi gani?", en: "How much stress are you under these days?" },
    options: [o("low", "Kidogo", "Low"), o("mid", "Wastani", "Medium"), o("high", "Kubwa", "High")],
  },
];

const BODY: Question[] = [
  { id: "height", kind: "number", optional: true, unit: "cm", min: 120, max: 230, title: { sw: "Urefu wako (sentimita)", en: "Your height (cm)" } },
  { id: "weight", kind: "number", optional: true, unit: "kg", min: 35, max: 250, title: { sw: "Uzito wako (kilo)", en: "Your weight (kg)" } },
];

/** The areas he chose, in the order the plan looks at them. */
export function chosenConcerns(a: Answers): ConcernId[] {
  const picked = Array.isArray(a.concerns) ? a.concerns : [];
  return CONCERN_PRIORITY.filter((c) => picked.includes(c));
}

export const list = (v: Answers[string]): string[] => (Array.isArray(v) ? v : typeof v === "string" ? [v] : []);

/** The questions to ask, given what he has answered so far. */
export function questionsFor(a: Answers): Question[] {
  const qs: Question[] = [AGE, GOALS_Q, CONCERNS_Q];
  const concerns = chosenConcerns(a);
  for (const c of concerns) qs.push(sure(c), ...FOLLOW_UPS[c]);
  if (list(a.concerns).includes("unsure")) qs.push(UNSURE_RED);
  if (concerns.some((c) => a[`sure_${c}`] === "diagnosed")) qs.push(TREATMENT);
  qs.push(...LIFESTYLE);
  const goals = list(a.goals);
  if (concerns.some((c) => c === "weight" || c === "bp" || c === "sugar") || goals.includes("fit")) qs.push(...BODY);
  return qs;
}

/** Is this question answered well enough to move on? */
export function answered(q: Question, v: Answers[string]): boolean {
  if (q.kind === "many") return Array.isArray(v) && v.length > 0;
  if (q.kind === "number") return typeof v === "number" && v >= (q.min ?? -Infinity) && v <= (q.max ?? Infinity);
  return typeof v === "string" && (q.options ?? []).some((x) => x.id === v);
}

/** Tick or untick an option of a "many" question (an "only" option clears the rest, and the other way round). */
export function toggleMany(q: Question, current: Answers[string], id: string): string[] {
  const cur = list(current);
  if (cur.includes(id)) return cur.filter((x) => x !== id);
  const opt = q.options?.find((x) => x.id === id);
  if (opt?.only) return [id];
  const onlyIds = new Set((q.options ?? []).filter((x) => x.only).map((x) => x.id));
  return [...cur.filter((x) => !onlyIds.has(x)), id];
}

/** Drop answers to questions that are no longer asked (e.g. he un-ticked a concern). */
export function tidyAnswers(a: Answers): Answers {
  const keep = new Set(questionsFor(a).map((q) => q.id));
  const out: Answers = {};
  for (const [k, v] of Object.entries(a)) if (keep.has(k) && v !== undefined) out[k] = v;
  return out;
}

/** Whole assessment done: every question that isn't optional has an answer. */
export function complete(a: Answers): boolean {
  return questionsFor(a).every((q) => q.optional || answered(q, a[q.id]));
}
