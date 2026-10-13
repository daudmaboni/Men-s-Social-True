// Checks Studio content before it is published.
// BLOCK = can't publish (selling, contact details, promises). WARN = allowed, but read it again.
// English and Kiswahili. Pure function, so it's easy to test and to reuse on the server later.

import type { ContentItem } from "../content/types";

export interface ClaimIssue {
  level: "block" | "warn";
  rule: string;
  message: string;
  /** The words that triggered it, so the editor can find them. */
  match: string;
}

type Rule = {
  level: "block" | "warn";
  rule: string;
  message: string;
  re: RegExp;
  /** Not a problem when the same sentence is WARNING readers about such promises. */
  okInWarning?: boolean;
};

const WARNING_SENTENCE = /\b(?:careful|cautious|beware|warning sign|be wary|avoid|promis(?:e|es|ing)|claims?|tahadhari|kuwa makini|epuka|ahadi)\b/i;

const RULES: Rule[] = [
  // Contact details and selling — the app is education, orders happen in the Shop later
  { level: "block", rule: "phone", message: "Phone numbers aren't allowed in content.", re: /(?:\+?255|\b0)[\s-]?[67]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g },
  { level: "block", rule: "link", message: "Links to WhatsApp, Telegram or shops aren't allowed. Use the Shop (coming later).", re: /\b(?:wa\.me|whatsapp\.com|chat\.whatsapp|t\.me|bit\.ly)\S*/gi },
  { level: "block", rule: "price", message: "Prices aren't allowed in educational content.", re: /\b(?:tzs|tsh|tshs|sh\.?|shilingi)\s?\d[\d,.]*\b|\b\d[\d,.]*\s?(?:tzs|tsh|tshs|\/=)/gi },
  { level: "block", rule: "order", message: "Ordering or 'DM us' messages aren't allowed in content.", re: /\b(?:order now|dm us|inbox us|call us|tupigie|agiza sasa|tuma ujumbe|piga simu)\b/gi },
  // Promises of results
  { level: "block", rule: "guarantee", message: "Don't promise guaranteed results.", re: /\b(?:100\s?%|guarantee[ds]?|guaranteed|uhakika wa 100|bila shaka utapona|permanent(?:ly)? cure[sd]?|miracle|instant(?:ly)? cure[sd]?)/gi, okInWarning: true },
  { level: "block", rule: "cure-promise", message: "Don't say a product or food cures a condition.", re: /\b(?:cures?|will cure|inatibu|itatibu|unatibu|inaponya|itaponya) (?:erectile|ed\b|impotence|premature|infertility|ugumba|nguvu za kiume|kisukari|diabetes|ukosefu)/gi },
  // Words that need a careful second read
  { level: "warn", rule: "cure-word", message: "Medical words — make sure this is education, not a treatment promise.", re: /\b(?:cures?|cured|heals?|treats?|treatment|tiba|kutibu|kuponya|dawa)\b/gi },
  { level: "warn", rule: "product", message: "Product names belong in the Shop, not in lessons.", re: /\b(?:kayapower|tumboflux|kayani herbs product)\b/gi },
  { level: "warn", rule: "fast-result", message: "Avoid promising fast results (days or minutes).", re: /\b(?:within|in) \d+ (?:days?|minutes?|hours?)\b|\bndani ya (?:siku|dakika|saa) \d+/gi },
];

/** Every piece of text a reader can see. */
export function itemText(item: Partial<ContentItem>): string {
  return [
    item.title,
    item.titleSw,
    item.summary,
    item.question,
    ...(item.body ?? []),
    ...(item.bodySw ?? []),
    ...(item.keyPoints ?? []),
    ...(item.quiz ?? []).flatMap((q) => [q.q, q.explain, ...q.options]),
  ]
    .filter(Boolean)
    .join("\n");
}

export function checkClaims(item: Partial<ContentItem>): ClaimIssue[] {
  const text = itemText(item);
  const issues: ClaimIssue[] = [];
  const blockedSpans: [number, number][] = [];

  for (const r of RULES) {
    for (const m of text.matchAll(r.re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (r.okInWarning && WARNING_SENTENCE.test(sentenceAt(text, start, end))) continue;
      // a word already blocked (e.g. "cures erectile") doesn't also need a warning
      if (r.level === "warn" && blockedSpans.some(([s, e]) => start >= s && end <= e)) continue;
      if (r.level === "block") blockedSpans.push([start, end]);
      if (!issues.some((i) => i.rule === r.rule && i.match.toLowerCase() === m[0].toLowerCase())) {
        issues.push({ level: r.level, rule: r.rule, message: r.message, match: m[0].trim() });
      }
    }
  }
  return issues.sort((a, b) => (a.level === b.level ? 0 : a.level === "block" ? -1 : 1));
}

function sentenceAt(text: string, start: number, end: number): string {
  const before = text.slice(0, start);
  const from = Math.max(before.lastIndexOf("."), before.lastIndexOf("\n"), before.lastIndexOf("!"), before.lastIndexOf("?")) + 1;
  const rest = text.slice(end).search(/[.!?\n]/);
  return text.slice(from, rest === -1 ? text.length : end + rest);
}

export const hasBlocks = (issues: ClaimIssue[]) => issues.some((i) => i.level === "block");
