// Card maker: what the AI is told when it turns staff material (text, a PDF, a photo, a link, notes
// about an audio or video) into one "do this" card for Discover. Pure (no network), tested.

import { cleanAction, ACTION_RESULTS, ACTION_TYPES, CHALLENGE_IDS } from "../content/action-shape";
import { CARD_PHOTOS, type CardPhoto } from "../content/card-photos";
import type { ActionSpec } from "../content/types";

export const CARD_SYSTEM = `You turn material from Kayani Herbs (Tanzania) into ONE "do this" card for the Men's Social app.
The card is something a man can apply and feel, not an article. Rules:
- Action first. The title starts with a verb or names the thing to do. Never "What is…".
- 3 to 8 short steps, each one thing to do, in order. Keep the real amounts, times and how-to from the material.
- Write like a big brother talking (kaka), not like a doctor or a textbook. Short sentences. No buzzwords, no "unlock", "journey", "game-changer", no em dashes.
- Kiswahili must be natural Tanzanian Kiswahili, the way Kayani's own posts sound ("mashine", "shoo", "bao", "mkeo" are fine). Not a word-for-word translation.
- No disclaimers, no "angalizo", no "tahadhari", no "see a doctor" lines. If something is risky for some men, put it inside a step as what to do instead (e.g. "On BP pills? Use the watermelon drink instead").
- Never write prices, phone numbers, product or brand names, offers, "order now", "100%", "guaranteed", "cures", "money back".
- Adults in a relationship. Bedroom techniques are fine, written directly but not pornographic.
- If the material has nothing a man can actually do, still make the best practical card you can from it.`;

const SHAPE = `{
 "title": [english, kiswahili], "hook": [english, kiswahili] (one or two short lines that make him want to swipe),
 "type": one of ${JSON.stringify(ACTION_TYPES)},
 "challenges": one to three of ${JSON.stringify(CHALLENGE_IDS)} (last = last longer, hard = stronger erections, her = satisfy her, mixes = natural mixes/drinks, train = exercises, reset = quit porn/confidence, desire = desire and round two),
 "results": one of ${JSON.stringify(ACTION_RESULTS)} (tonight = works the same night, days, weeks2 = 1–3 weeks, weeks4 = 3–6 weeks, daily = a daily habit),
 "minutes": number (time to read and do it once),
 "need": [[english, kiswahili], ...] (ingredients or things to have ready; empty if none),
 "steps": [{"title": [english, kiswahili] or null, "text": [english, kiswahili]}, ...],
 "why": [english, kiswahili] or null (one or two lines: why it works),
 "ask": null, or a question that opens the card and makes him curious, answered by the card: {"kind": "question" or "truefalse", "q": [english, kiswahili] (a question, or a statement men often believe), "truth": true or false (truefalse only), "a": [english, kiswahili] (the short answer or explanation)},
 "photo": one of ${JSON.stringify(CARD_PHOTOS)} (the background photo that fits best)
}`;

export type CardSource =
  | { kind: "text"; text: string }
  | { kind: "pdf"; base64: string; name: string }
  | { kind: "image"; base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp"; name: string }
  | { kind: "link"; url: string; text: string }
  | { kind: "media"; mediaKind: "audio" | "video"; name: string; notes: string; frames?: string[] };

type Block = { type: "text"; text: string } | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } } | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

/** The user message for the AI: the material, then the instructions and the shape to reply in. */
export function buildCardMessage(src: CardSource, notes = ""): Block[] {
  const blocks: Block[] = [];
  const extra = notes.trim() ? `\nNotes from the editor: ${notes.trim().slice(0, 2000)}` : "";
  if (src.kind === "pdf") {
    blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: src.base64 } });
    blocks.push({ type: "text", text: `The PDF above ("${src.name}") is the material.${extra}` });
  } else if (src.kind === "image") {
    blocks.push({ type: "image", source: { type: "base64", media_type: src.mediaType, data: src.base64 } });
    blocks.push({ type: "text", text: `The image above ("${src.name}") is the material: read any text in it and use what it shows.${extra}` });
  } else if (src.kind === "link") {
    blocks.push({ type: "text", text: `Material from ${src.url}:\n\n${src.text.slice(0, 15000)}${extra}` });
  } else if (src.kind === "media") {
    // Step 85: still pictures from a video (to read words on screen) and what was said (transcribed in the Studio)
    const frames = (src.frames ?? []).slice(0, 6);
    for (const f of frames) blocks.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: f } });
    const seen = frames.length ? `The ${frames.length} pictures above are stills from the video, in order: read any words written on screen and use what they show.\n` : "";
    const said = src.notes.trim()
      ? `What it says (a transcript made in the Studio and checked by the editor, plus any notes):\n\n${src.notes.slice(0, 15000)}`
      : "There's no transcript; use the stills.";
    blocks.push({
      type: "text",
      text: `The editor uploaded a ${src.mediaKind} ("${src.name}"). It will play on the card.\n${seen}${said}`,
    });
  } else {
    blocks.push({ type: "text", text: `Material:\n\n${src.text.slice(0, 15000)}${extra}` });
  }
  blocks.push({ type: "text", text: `Make the card. Reply with ONLY valid JSON, no other text, in this shape:\n${SHAPE}` });
  return blocks;
}

export interface CardDraft {
  title: string;
  titleSw: string;
  summary: string;
  summarySw: string;
  minutes: number;
  photo: CardPhoto;
  action: ActionSpec;
}

const pair = (v: unknown): [string, string] => {
  const a = Array.isArray(v) ? v : [];
  const en = typeof a[0] === "string" ? a[0].trim() : "";
  const sw = typeof a[1] === "string" ? a[1].trim() : "";
  return [en || sw, sw || en];
};

/** Pull the card out of the AI's reply. Throws a plain message if it isn't usable. */
export function parseCard(raw: string): CardDraft {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The AI didn't return a card. Try again.");
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new Error("The AI's card wasn't in the expected format. Try again.");
  }
  const [title, titleSw] = pair(d.title);
  const [summary, summarySw] = pair(d.hook);
  if (!title) throw new Error("The AI's card has no title. Try again.");
  const steps = (Array.isArray(d.steps) ? d.steps : []).map((s) => {
    const o = (s ?? {}) as Record<string, unknown>;
    const [text, textSw] = pair(o.text);
    const t = o.title ? pair(o.title) : null;
    return { text, textSw, ...(t && t[0] ? { title: t[0], titleSw: t[1] } : {}) };
  });
  const need = (Array.isArray(d.need) ? d.need : []).map(pair).filter((p) => p[0]);
  const why = d.why ? pair(d.why) : null;
  // Step 86: a question first, when the AI found a good one (staff can change or remove it)
  const ask = d.ask && typeof d.ask === "object" ? (d.ask as Record<string, unknown>) : null;
  const [q, qSw] = ask ? pair(ask.q) : ["", ""];
  const [a, aSw] = ask ? pair(ask.a) : ["", ""];
  const action = cleanAction({
    ...(ask && q && a ? { ask: { kind: ask.kind, q, qSw, a, aSw, truth: ask.truth === true } } : {}),
    type: d.type,
    challenges: d.challenges,
    results: d.results,
    steps,
    need: need.map((p) => p[0]),
    needSw: need.map((p) => p[1]),
    ...(why && why[0] ? { why: why[0], whySw: why[1] } : {}),
  });
  if (!action) throw new Error("The AI's card has no usable steps. Try again, or add more detail.");
  const photo = CARD_PHOTOS.includes(d.photo as CardPhoto) ? (d.photo as CardPhoto) : "man-confident";
  const minutes = Math.min(30, Math.max(1, Math.round(Number(d.minutes) || 2)));
  return { title: title.slice(0, 120), titleSw: titleSw.slice(0, 120), summary: summary.slice(0, 240), summarySw: summarySw.slice(0, 240), minutes, photo, action };
}
