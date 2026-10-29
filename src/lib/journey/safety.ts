// Step 100: fixed safety rules for My Journey. Checked before any plan is made; the AI never decides these.
//
//  emergency — go to hospital now (warning signs listed by the NHS / AHA for each area)
//  crisis    — thoughts of self-harm: the same caring reply Kito gives (lib/kito/prompt.ts CRISIS_REPLY)
//  today     — see a doctor today
//  soon      — book a visit to a doctor or health worker in the coming days
//
// Kept as plain rules, each with its source, so a clinician can read and change them. Every rule is tested.
// The plan never suggests a medicine, supplement or herb, and never says to stop a treatment.

import { CRISIS_REPLY } from "../kito/prompt";
import { chosenConcerns, list } from "./questions";
import type { Answers, ConcernId, Level, Restriction, SafetyNote, Txt } from "./types";

const t = (sw: string, en: string): Txt => ({ sw, en });

const GO_NOW = t(
  "Hii ni ishara ya hatari. Nenda hospitali au kituo cha afya kilicho karibu sasa hivi, au mwombe mtu akupeleke. Usisubiri kuona kama itapita.",
  "This is a warning sign. Go to the nearest hospital or health centre now, or ask someone to take you. Don't wait to see if it passes.",
);

/** Most serious first. */
export const LEVEL_ORDER: Level[] = ["emergency", "crisis", "today", "soon"];

function hit(a: Answers, q: string, ids: string[]): boolean {
  const got = list(a[q]);
  return ids.some((id) => got.includes(id));
}

/** Every safety note his answers lead to, most serious first, each once. */
export function safetyCheck(a: Answers): SafetyNote[] {
  const notes: SafetyNote[] = [];
  const add = (n: SafetyNote) => {
    if (!notes.some((x) => x.id === n.id)) notes.push(n);
  };
  const concerns = chosenConcerns(a);
  const has = (c: ConcernId) => concerns.includes(c);
  const certain = (c: ConcernId) => a[`sure_${c}`];

  // ── Emergencies ──
  if (has("erection") && hit(a, "ed_red", ["long"]))
    add({ id: "em-priapism", level: "emergency", concern: "erection", title: t("Uume uliosimama saa 4 au zaidi", "An erection lasting 4 hours or more"), body: GO_NOW, source: "NHS: Priapism" });
  if (has("erection") && hit(a, "ed_red", ["injury"]))
    add({ id: "em-penile-injury", level: "emergency", concern: "erection", title: t("Maumivu au kupinda ghafla kwa uume", "Sudden pain or bending of the penis"), body: GO_NOW, source: "NHS: Penile injury" });
  if (has("hernia") && hit(a, "hr_red", ["stuck", "vomit", "blocked", "pain"]))
    add({ id: "em-hernia", level: "emergency", concern: "hernia", title: t("Ngiri yenye dalili za hatari", "Hernia warning signs"), body: GO_NOW, source: "NHS: Hernia" });
  if (has("digestion") && hit(a, "dg_red", ["vomit_blood", "black", "blood_stool", "severe"]))
    add({ id: "em-stomach", level: "emergency", concern: "digestion", title: t("Damu au maumivu makali tumboni", "Bleeding or severe belly pain"), body: GO_NOW, source: "NHS: Stomach ulcer" });
  if (has("bp") && hit(a, "bp_red", ["headache", "chest", "breath", "stroke", "vision"]))
    add({ id: "em-bp", level: "emergency", concern: "bp", title: t("Dalili za hatari za moyo au kiharusi", "Heart or stroke warning signs"), body: GO_NOW, source: "AHA: Hypertensive crisis · NHS: Stroke" });
  if (has("sugar") && hit(a, "sg_red", ["confused", "vomit", "breath", "shaky"]))
    add({ id: "em-sugar", level: "emergency", concern: "sugar", title: t("Dalili za hatari za sukari", "Blood sugar warning signs"), body: GO_NOW, source: "NHS: Diabetes" });
  if (has("back") && hit(a, "bk_red", ["numb", "control", "legs"]))
    add({ id: "em-back", level: "emergency", concern: "back", title: t("Dalili za hatari za mgongo", "Back warning signs"), body: GO_NOW, source: "NHS: Cauda equina syndrome" });
  if (list(a.concerns).includes("unsure") && hit(a, "gen_red", ["chest", "breath", "faint", "stroke", "blood"]))
    add({ id: "em-general", level: "emergency", title: t("Dalili za hatari", "Warning signs"), body: GO_NOW, source: "NHS: When to go to A&E" });

  // ── Crisis ──
  if (has("mind") && a.md_harm === "yes")
    add({ id: "crisis", level: "crisis", concern: "mind", title: t("Hauko peke yako", "You're not alone"), body: { sw: CRISIS_REPLY.sw, en: CRISIS_REPLY.en } });

  // ── See a doctor today ──
  if (has("erection") && hit(a, "ed_red", ["chest"]))
    add({
      id: "today-chest",
      level: "today",
      concern: "erection",
      title: t("Kifua kuuma ukifanya kazi ngumu", "Chest pain when you exert yourself"),
      body: t("Hili linahitaji daktari leo, kabla ya mazoezi mapya. Moyo na mishipa vinaangaliwa kwanza.", "This needs a doctor today, before any new exercise. The heart and blood vessels come first."),
      source: "NHS: Erection problems",
    });
  if (has("bp") && a.bp_high === "yes")
    add({
      id: "today-bp",
      level: "today",
      concern: "bp",
      title: t("Presha ya 180/120 au zaidi", "A reading of 180/120 or higher"),
      body: t("Kipimo hiki ni kikubwa sana. Pima tena, na umwone daktari leo hata kama unajisikia sawa.", "That's very high. Measure again and see a doctor today, even if you feel fine."),
      source: "AHA: Hypertensive crisis",
    });
  if (has("back") && hit(a, "bk_red", ["fall", "fever"]))
    add({
      id: "today-back",
      level: "today",
      concern: "back",
      title: t("Maumivu ya mgongo baada ya ajali au na homa", "Back pain after an accident or with a fever"),
      body: t("Mwone daktari leo, kabla ya kuanza mazoezi yoyote ya mgongo.", "See a doctor today, before any back exercises."),
      source: "NHS: Back pain",
    });

  // ── Book a visit soon ──
  const soon = (id: string, concern: ConcernId | undefined, title: Txt, body: Txt, source: string) => add({ id, level: "soon", concern, title, body, source });
  if (has("erection") && certain("erection") !== "diagnosed")
    soon(
      "soon-erection-check",
      "erection",
      t("Pima presha, sukari na moyo", "Check blood pressure, sugar and heart"),
      t("Matatizo ya kusimama mara nyingi ni dalili ya kwanza ya presha, sukari au mishipa. Kipimo kimoja kliniki kinakupa jibu la uhakika.", "Erection trouble is often the first sign of blood pressure, sugar or blood vessel problems. One clinic visit gives you a real answer."),
      "NHS: Erection problems",
    );
  if (has("early") && hit(a, "pe_red", ["pain", "blood"]))
    soon("soon-early", "early", t("Maumivu au damu wakati wa kumwaga", "Pain or blood when you finish"), t("Hili lina sababu zake zinazotibika. Mwone daktari siku hizi.", "This has its own causes that can be treated. See a doctor in the coming days."), "NHS: Ejaculation problems");
  if (has("hernia") && certain("hernia") !== "diagnosed")
    soon("soon-hernia", "hernia", t("Thibitisha kama ni ngiri", "Get the hernia confirmed"), t("Daktari anaweza kuthibitisha kwa kukushika tu. Mpaka hapo epuka kubeba vitu vizito.", "A doctor can usually confirm it just by examining you. Until then, avoid heavy lifting."), "NHS: Hernia");
  if (has("digestion") && (hit(a, "dg_red", ["weight", "swallow"]) || a.dg_meds === "often" || (hit(a, "dg_signs", ["burn"]) && certain("digestion") !== "diagnosed")))
    soon(
      "soon-stomach",
      "digestion",
      t("Tumbo lako lipimwe", "Get your stomach checked"),
      t("Maumivu ya kuungua, kupungua uzito, kumeza kwa shida au kutumia dawa za maumivu mara kwa mara ni sababu ya kumwona daktari. Kipimo kinaonyesha kama ni kidonda.", "Burning pain, weight loss, trouble swallowing or regular painkillers are reasons to see a doctor. A test shows whether it's an ulcer."),
      "NHS: Stomach ulcer · Indigestion",
    );
  if (has("sugar") && certain("sugar") !== "diagnosed" && list(a.sg_signs).filter((x) => x !== "none").length > 0)
    soon("soon-sugar", "sugar", t("Pima sukari", "Get a blood sugar test"), t("Dalili ulizotaja ni sababu ya kupima sukari. Ni kipimo kidogo, kliniki au famasi.", "The signs you mentioned are a reason to test your blood sugar. It's a quick test at a clinic or pharmacy."), "NHS: Type 2 diabetes");
  if (has("mind") && a.md_harm !== "yes" && Number(a.md_interest ?? 0) + Number(a.md_down ?? 0) >= 3)
    soon(
      "soon-mind",
      "mind",
      t("Ongea na mtaalamu", "Talk to a professional"),
      t("Majibu yako yanaonyesha umebeba mzigo mzito wiki hizi. Kuongea na daktari au mshauri kunasaidia, na si udhaifu.", "Your answers show you've been carrying a lot these weeks. Talking to a doctor or counsellor helps, and it isn't weakness."),
      "PHQ-2 screening (score 3 or more)",
    );
  if (has("back") && certain("back") !== "diagnosed")
    soon("soon-back", "back", t("Mgongo upimwe", "Get your back checked"), t("Kama maumivu hayapungui ndani ya wiki chache, mwone daktari au mtaalamu wa viungo.", "If the pain isn't easing within a few weeks, see a doctor or physiotherapist."), "NHS: Back pain");
  if (list(a.concerns).includes("unsure"))
    soon("soon-general", undefined, t("Kipimo cha afya cha jumla", "A general health check"), t("Hujui ni nini, na hiyo ni sawa. Daktari anaweza kukupima presha, sukari na kukusikiliza. Mpango huu unaanza na misingi.", "You don't know what it is, and that's fine. A doctor can check your blood pressure and sugar and listen to you. This plan starts with the basics."), "NHS: Health checks");

  return notes.sort((x, y) => LEVEL_ORDER.indexOf(x.level) - LEVEL_ORDER.indexOf(y.level));
}

/** Stop the plan and show help first? */
export const blocksPlan = (notes: SafetyNote[]) => notes.some((n) => n.level === "emergency" || n.level === "crisis");

/** Which kinds of exercise to leave out for him. */
export function restrictions(a: Answers): Set<Restriction> {
  const r = new Set<Restriction>();
  const concerns = chosenConcerns(a);
  if (concerns.includes("hernia")) r.add("no-strain");
  if (concerns.includes("back")) {
    r.add("gentle");
    r.add("no-strain");
  }
  if (concerns.includes("sugar") && (a.sg_meds === "insulin" || a.sg_meds === "tablets")) r.add("meds-exercise");
  // Chest pain on effort: nothing harder than walking until a doctor has seen him
  if (hit(a, "ed_red", ["chest"]) || a.bp_high === "yes") r.add("gentle");
  return r;
}

/** Body mass index from his height and weight (WHO formula), or null if he skipped them. */
export function bmi(a: Answers): number | null {
  const h = typeof a.height === "number" ? a.height / 100 : null;
  const w = typeof a.weight === "number" ? a.weight : null;
  if (!h || !w) return null;
  return Math.round((w / (h * h)) * 10) / 10;
}
