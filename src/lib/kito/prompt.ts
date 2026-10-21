// Kito's rules and replies (Step 67). Pure: no network, tested.
// Kito only answers from the sources it's given (Kayani's own library), says plainly when the library
// doesn't cover a question, and never invents facts, doses, diagnoses or products.
// Separate from the staff drafting prompts in lib/ai/prompts.ts.

import type { Hit, KitoDoc } from "./search";
import { excerpt } from "./search";

export type Lang = "en" | "sw";
export interface Turn {
  role: "user" | "kito";
  text: string;
}

export const KITO_SYSTEM = `You are Kito, the learning assistant inside Men's Social, a men's wellness app by Kayani Herbs in Tanzania.
You talk like a calm, confident big brother ("kaka"): short, warm, direct, no lecturing, no shame.

How you answer:
- Use ONLY the numbered SOURCES you are given (Kayani's own guides, cards and course lessons). They are the library.
- If the sources answer the question, explain the answer in your own words in 2–6 short sentences or a few short steps, and say which sources you used.
- If the sources don't really answer it, say so plainly and briefly ("I don't have a guide on that yet"), then point to the closest source if one is useful. Never fill the gap from your own knowledge. Set "confident" to false.
- Never invent facts, numbers, doses, timings, ingredients or results that aren't in the sources.
- Never diagnose, never say what condition he has, never prescribe medicine. No product names, prices, phone numbers or selling.
- No disclaimers or warnings unless the question describes something that needs a doctor soon (strong pain, blood, an erection that won't go down for hours, sudden swelling, chest pain): then say clearly, in one sentence, to see a doctor today.
- Reply in the language he wrote in (Kiswahili or English). Natural Tanzanian Kiswahili, not word-for-word translation.
- Adults only. Respectful, not explicit.
- Questions about anything outside men's wellness and the app (news, sport, money, politics…): say kindly that you only help with what's in the Men's Social library.

Reply with ONLY valid JSON, no other text:
{"answer": string, "used": number[] (the source numbers you used, can be empty), "confident": boolean}`;

/** The message sent with the question: his language, the last few turns, and the sources. */
export function buildKitoMessage(question: string, hits: Hit[], lang: Lang, history: Turn[] = []): string {
  const past = history
    .slice(-4)
    .map((t) => `${t.role === "user" ? "He asked" : "You answered"}: ${t.text.slice(0, 400)}`)
    .join("\n");
  const sources = hits.length
    ? hits.map((h, i) => `[${i + 1}] ${lang === "sw" && h.doc.titleSw ? h.doc.titleSw : h.doc.title} (${h.doc.kind})\n${excerpt(h.doc, lang)}`).join("\n\n")
    : "(no sources matched)";
  return [
    `His app language: ${lang === "sw" ? "Kiswahili" : "English"}.`,
    past ? `Earlier in this chat:\n${past}` : "",
    `SOURCES:\n${sources}`,
    `His question: ${question.slice(0, 600)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** A guide Kito used, as the app shows it under the answer. */
export interface KitoSource {
  id: string;
  title: string;
  href: string;
  kind: KitoDoc["kind"];
}

export interface KitoReply {
  answer: string;
  used: number[];
  confident: boolean;
}

/** Pull the reply out of the AI's text; anything odd becomes an honest "not sure". */
export function parseKito(raw: string, sourceCount: number): KitoReply {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no JSON");
  const j = JSON.parse(m[0]) as Partial<KitoReply>;
  const answer = typeof j.answer === "string" ? j.answer.trim().slice(0, 1500) : "";
  if (!answer) throw new Error("empty answer");
  const used = [...new Set((Array.isArray(j.used) ? j.used : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= sourceCount))];
  // "Confident" only counts when it really used the library
  return { answer, used, confident: j.confident !== false && used.length > 0 };
}

/* ───────── Rules checked before any AI (safety) ───────── */
export type Flag = "crisis" | "urgent" | null;

const CRISIS = /\b(suicid\w*|kill myself|end my life|want to die|self[- ]?harm|kujiua|nataka kufa|kujidhuru|sitaki kuishi|maisha hayana maana)\b/i;
const URGENT =
  /(chest pain|maumivu ya kifua|blood in (my )?(urine|semen|sperm)|damu (kwenye|katika) (mkojo|shahawa|mbegu)|erection (that )?(won'?t|will not) go down|(4|four|5|6|five|six) hours?.{0,20}(erect|hard)|(erect|hard).{0,20}(4|four|5|6) hours?|kusimama masaa|imesimama masaa|sudden(ly)? .{0,20}(swell|swollen|pain).{0,20}(testic|ball|scrot)|korodani.{0,30}(maumivu|kuvimba)|(maumivu|kuvimba).{0,30}korodani)/i;

export function safetyFlag(question: string): Flag {
  if (CRISIS.test(question)) return "crisis";
  if (URGENT.test(question)) return "urgent";
  return null;
}

/** For a crisis, Kito doesn't use AI at all: it answers with care and points to people who can help now. */
export const CRISIS_REPLY: Record<Lang, string> = {
  en: "Kaka, I'm really glad you said something. What you're feeling matters, and you don't have to carry it alone. Please talk to someone right now: a person you trust, or go to the nearest hospital or health centre today. If you might hurt yourself, call emergency services or ask someone to take you to hospital now.",
  sw: "Kaka, nashukuru umesema. Unachohisi ni muhimu, na huhitaji kubeba hili peke yako. Tafadhali ongea na mtu sasa hivi: mtu unayemwamini, au nenda hospitali au kituo cha afya kilicho karibu leo. Kama unaweza kujidhuru, piga simu ya dharura au mwombe mtu akupeleke hospitali sasa.",
};

/** For urgent body signs, this line goes first, whatever the library says. */
export const URGENT_LINE: Record<Lang, string> = {
  en: "This needs a doctor today, kaka. Please go to a clinic or hospital now, before trying anything at home.",
  sw: "Hili linahitaji daktari leo, kaka. Tafadhali nenda kliniki au hospitali sasa, kabla ya kujaribu chochote nyumbani.",
};

export const NOT_IN_LIBRARY: Record<Lang, string> = {
  en: "I don't have a guide on that yet, so I'd rather not guess. Try asking it another way, or ask the men in Community.",
  sw: "Sina mwongozo kuhusu hilo bado, kwa hiyo sitaki kubahatisha. Jaribu kuuliza kwa njia nyingine, au waulize wanaume wenzako kwenye Jumuiya.",
};

/**
 * Kito's answer straight from the library, with no AI (Step 67b): used when the AI isn't connected or
 * doesn't answer, so he still gets the steps — the best matching guide, in his language, plus where to read more.
 */
export function libraryAnswer(hits: Hit[], lang: Lang): string {
  const top = hits[0]?.doc;
  if (!top) return NOT_IN_LIBRARY[lang];
  const title = lang === "sw" && top.titleSw ? top.titleSw : top.title;
  const lines = (lang === "sw" ? top.sw : top.en)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => l !== title && !l.endsWith(title))
    // section headings from the guide's full page ("Fanya hivi", "Mahitaji"…) aren't needed here
    .filter((l) => !/^(fanya hivi|mahitaji|siri yake|do this|you need|the secret)$/i.test(l));
  const body = [...new Set(lines)].slice(0, 8).join("\n");
  const more = hits.length > 1 ? (lang === "sw" ? "\n\nSoma zaidi hapa chini." : "\n\nRead more below.") : "";
  return `${lang === "sw" ? "Kaka, hiki ndicho kinachosaidia" : "Kaka, here's what helps"}: ${title}\n\n${body}${more}`;
}
