// Reel titles and captions, tidied for reading (Step 81). Captions often come from Instagram:
// one long run of text with "•" lists, "✅" points, headings like "MAHITAJI:" and lots of CAPITALS.
// Nothing is changed in the Studio; this only decides how it shows.
//  - Title: no "Kayani Herbs" in front (the name already shows above it), no "..." in the middle,
//    no shouting, at most ~90 characters, cut at a word.
//  - Caption: split into headings, list points and short paragraphs; hashtags at the end dropped.
// Pure functions, tested in caption.test.ts.

export type CaptionBlock =
  | { kind: "text"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "item"; mark: string; text: string };

const BRAND = /^\s*kayani\s*herbs?\b[\s:|,–—-]*/i;
const MARKS = ["•", "✅", "✔️", "✔", "👉", "➡️", "🔹", "🔸", "▪️", "-"];
const MARK_RE = /\s*(•|✅|✔️|✔|👉|➡️|🔹|🔸|▪️)\s*/g;
/** Letters only, any alphabet; used to spot words written all in capitals. */
const WORD_CAPS = /\b(\p{Lu}{4,})\b/gu;
/** Kept as written: real short forms. */
const KEEP = new Set(["TMDA", "HIV", "AIDS", "VVU", "UKIMWI", "TZS", "COVID"]);

/** "ZITOO" → "zitoo", leaving short forms (TMDA, HIV) and short words (E, OK) alone. */
export function tameCaps(s: string): string {
  return s.replace(WORD_CAPS, (w) => (KEEP.has(w) ? w : w.toLowerCase()));
}

const upperFirst = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

export function cleanTitle(raw: string, max = 90): string {
  let t = (raw ?? "").replace(BRAND, "");
  t = t.replace(/\s*(\.{2,}|…)\s*/g, ", ").replace(/\s+/g, " ").trim();
  t = t.replace(/^[,;:–—-]+\s*/, "").replace(/[,;:–—-]+$/, "").trim();
  t = upperFirst(tameCaps(t));
  if (t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, "").replace(/[,;:–—-]+$/, "") + "…";
  return t || (raw ?? "").trim();
}

/** Drops hashtags at the very end (a block of #tags) and the brand name at the very start. */
function strip(text: string): string {
  return text
    .replace(BRAND, "")
    .replace(/(\s*#[\p{L}\p{N}_]+)+\s*$/u, "")
    .trim();
}

/** Turns one long caption into headings, list points and short paragraphs. */
export function parseCaption(raw: string): CaptionBlock[] {
  let text = strip(raw ?? "");
  if (!text) return [];
  // Headings written in capitals and ending with ":" go on their own line: "MAHITAJI:", "JINSI YA KUTUMIA:"
  text = text.replace(/(^|[\s.!?])((?:\p{Lu}{3,}[ \t]?){1,4}):/gu, (_m, before: string, head: string) => `${before}\n§${head.trim()}\n`);
  // Each "•" or "✅" starts a new line
  text = text.replace(MARK_RE, (m) => `\n${m.trim()} `);
  const blocks: CaptionBlock[] = [];
  for (const line of text.split(/\n+/)) {
    const l = line.trim();
    if (!l) continue;
    if (l.startsWith("§")) {
      blocks.push({ kind: "heading", text: upperFirst(l.slice(1).toLowerCase()) });
      continue;
    }
    const mark = MARKS.find((m) => l.startsWith(m + " ") || (m !== "-" && l.startsWith(m)));
    if (mark) {
      const body = l.slice(mark.length).trim();
      if (body) blocks.push({ kind: "item", mark: mark === "✅" || mark === "✔️" || mark === "✔" ? "✅" : "•", text: upperFirst(tameCaps(body)) });
      continue;
    }
    blocks.push({ kind: "text", text: upperFirst(tameCaps(l)) });
  }
  return blocks;
}

/** The first bit, as plain text, for the 2-line preview under a reel. */
export function captionPreview(raw: string): string {
  return parseCaption(raw)
    .map((b) => (b.kind === "heading" ? `${b.text}:` : b.text))
    .join(" ")
    .replace(/:\s*:/g, ":")
    .trim();
}

/** Worth a "more" link? */
export const isLongCaption = (raw: string) => {
  const b = parseCaption(raw);
  return b.length > 1 || (b[0]?.text.length ?? 0) > 110;
};
