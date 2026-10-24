// What the AI is asked to do, and the safety rules it always gets. Pure (testable, no network).

import { SW_VOICE } from "./swVoice";

export type AiAction = "draft" | "summarize" | "titles" | "quiz" | "translate" | "repurpose";
export const AI_ACTIONS: AiAction[] = ["draft", "summarize", "titles", "quiz", "translate", "repurpose"];

export type AiConfig = { enabled: boolean; tone: string; rules: string };
export const DEFAULT_AI: AiConfig = { enabled: false, tone: "warm, clear, non-judgemental, simple English", rules: "" };

export const SAFETY = `You write educational content for Men's Social, a men's wellness app in Tanzania (Kayani Herbs).
Rules you must always follow:
- General education only. Never diagnose, never tell someone what condition they have, never prescribe or dose medicines, supplements or herbs.
- No promises or guarantees ("cure", "100%", "permanent", "guaranteed"). No product names, prices, selling or contact details.
- Say when to see a qualified health professional, especially for pain, sudden changes, chest pain or symptoms lasting weeks.
- Respectful, private, non-shaming language. Adults only. No explicit sexual content.
- Only state facts that are widely accepted; if unsure, say so. Prefer the approved sources listed.`;

const asJson = (shape: string) => `Reply with ONLY valid JSON, no other text, in this shape: ${shape}`;

export function buildPrompt(action: AiAction, input: { text?: string; topic?: string; kind?: string; brief?: string; to?: string }, cfg: AiConfig, sources: string[]) {
  const system = [SAFETY, `Tone: ${cfg.tone || DEFAULT_AI.tone}.`, cfg.rules ? `Extra rules from the editors: ${cfg.rules}` : "", sources.length ? `Approved sources:\n${sources.map((s) => `- ${s}`).join("\n")}` : ""]
    .filter(Boolean)
    .join("\n\n");
  const text = (input.text ?? "").slice(0, 12000);
  const user: Record<AiAction, string> = {
    draft: `Write a short ${input.kind ?? "article"} (300–500 words) for men about the topic "${input.topic ?? "wellbeing"}". Brief from the editor: ${input.brief ?? "(none)"}.
Use short paragraphs; a paragraph starting with "## " is a heading. ${asJson('{"title": string, "summary": string (1–2 sentences), "body": string[] (paragraphs)}')}`,
    summarize: `Summarise this for the app card in 1–2 short sentences, saying what he gains.\n\n${text}\n\n${asJson('{"summary": string}')}`,
    titles: `Suggest 5 clear, respectful titles (max 70 characters) and 2 one-sentence descriptions for this content.\n\n${text}\n\n${asJson('{"titles": string[], "descriptions": string[]}')}`,
    quiz: `Write 4 multiple-choice questions that check understanding of this content. Each has 3–4 options, one correct, and a one-sentence explanation.\n\n${text}\n\n${asJson('{"questions": [{"q": string, "options": string[], "answer": number, "explain": string}]}')}`,
    translate: `Rewrite this in Kiswahili for Tanzanian men. Keep the meaning, "## " headings and paragraph breaks, but do not translate word for word.\n\n${SW_VOICE}\n\n${text}\n\n${asJson('{"title": string, "summary": string, "body": string[]}')}`,
    repurpose: `Turn this content into ${input.to === "expert" ? "an expert Q&A: one question a man would ask, and a clear answer" : "4–6 key points for a short video"}.\n\n${text}\n\n${asJson(
      input.to === "expert" ? '{"question": string, "body": string[]}' : '{"keyPoints": string[]}',
    )}`,
  };
  return { system, user: user[action] };
}

/** Pull the JSON object out of a reply and check it has the fields this action needs. */
export function parseResult(action: AiAction, raw: string): Record<string, unknown> {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The AI didn't return a usable answer. Try again.");
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new Error("The AI's answer wasn't in the expected format. Try again.");
  }
  const need: Record<AiAction, string[]> = {
    draft: ["title", "summary", "body"],
    summarize: ["summary"],
    titles: ["titles"],
    quiz: ["questions"],
    translate: ["title", "body"],
    repurpose: [],
  };
  for (const k of need[action]) if (data[k] === undefined) throw new Error(`The AI's answer is missing "${k}". Try again.`);
  if (action === "quiz") {
    const qs = data.questions as { q: string; options: string[]; answer: number; explain: string }[];
    if (!Array.isArray(qs) || qs.some((q) => typeof q.q !== "string" || !Array.isArray(q.options) || typeof q.answer !== "number" || q.answer < 0 || q.answer >= q.options.length)) {
      throw new Error("The quiz from the AI wasn't valid. Try again.");
    }
  }
  return data;
}
