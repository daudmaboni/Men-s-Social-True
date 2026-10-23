// Kito's library search (Step 67). Pure: no network, so it's tested and runs the same on the server.
// Finds the guides, "do this" cards and course lessons that best match a question, in English or Kiswahili.
// Simple and predictable on purpose: word matching (BM25) plus a small list of words that mean the same
// thing in both languages ("nguvu za kiume" ↔ erection, "kuwahi kufika" ↔ lasting longer…).

import type { ContentItem } from "../content/types";

export interface KitoDoc {
  id: string;
  kind: "guide" | "card" | "lesson";
  title: string;
  titleSw?: string;
  href: string;
  /** Text used for matching (both languages). */
  text: string;
  /** What Kito may quote, per language. */
  en: string;
  sw: string;
}

export interface Hit {
  doc: KitoDoc;
  score: number;
}

const STOP = new Set(
  (
    // English
    "a an the and or but if of to in on at for with by from is are was were be been am do does did have has had i me my you your he him his she her it its we our they them their this that these those what which who how why when where can could should would will shall may might just so not no yes very too about into over than then there here also any some more most much many get got make made take one two out up down off all as like really want need know tell please okay ok today now good best bad way ways thing things result " +
    // Kiswahili
    "na ya wa za la kwa ni katika kama au lakini pia hii hiyo huo hilo ile hizi hizo yangu yako yake yetu yenu yao mimi wewe yeye sisi nyinyi wao je nini gani vipi kwanini lini wapi nina una ana tuna mna wana sana tu hata bado kuna kwamba ili kwenye ndani nje juu chini baada kabla mpaka hadi kila mara moja mbili naomba tafadhali nisaidie naweza unaweza nifanye nifanyeje leo sasa nzuri vizuri jinsi namna"
  ).split(" "),
);

/** Words that mean the same thing; a question with one also finds the others. */
const SAME: string[][] = [
  ["erection", "erections", "hard", "harder", "stronger", "nguvu", "kusimama", "kusimamisha", "kudinda", "uume", "mkonga", "dhaifu", "weak", "ed"],
  ["last", "longer", "lasting", "premature", "early", "quick", "fast", "ejaculation", "ejaculate", "finish", "kuwahi", "haraka", "mapema", "kumwaga", "kufika", "bao", "mabao", "round", "rounds", "stamina", "kudumu", "muda"],
  ["desire", "libido", "drive", "mood", "hamu", "ashiki", "nyege", "msisimko"],
  ["wife", "partner", "her", "woman", "mke", "mkeo", "mwanamke", "mpenzi", "satisfy", "ridhisha", "kuridhisha", "furahisha"],
  ["sleep", "usingizi", "kulala", "night", "usiku", "tired", "uchovu", "chovu"],
  ["water", "maji", "drink", "kunywa", "hydration"],
  ["food", "foods", "eat", "diet", "chakula", "vyakula", "lishe", "kula", "fruit", "matunda", "juice", "juisi", "mix", "mchanganyiko"],
  ["exercise", "exercises", "workout", "train", "mazoezi", "zoezi", "kegel", "kegels", "pelvic", "nyonga", "jq", "st"],
  ["position", "positions", "mikao", "mkao", "style", "mtindo"],
  ["touch", "foreplay", "kuminya", "minya", "mguso", "mpapaso", "kisimi", "clitoris", "spot", "g-spot", "maeneo"],
  ["fertility", "sperm", "baby", "pregnant", "uzazi", "mbegu", "mtoto", "mimba", "shahawa"],
  ["stress", "anxiety", "worry", "nervous", "msongo", "wasiwasi", "hofu", "confidence", "kujiamini", "mindset", "akili"],
  ["belly", "stomach", "bloating", "gas", "tumbo", "gesi", "kuvimbiwa", "constipation", "choo"],
  ["porn", "masturbation", "punyeto", "ngono", "addiction", "uraibu"],
];
const GROUP = new Map<string, number>();
SAME.forEach((g, i) => g.forEach((w) => GROUP.set(w, i)));

export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

const join = (...parts: (string | string[] | undefined | null)[]) =>
  parts
    .flat()
    .filter(Boolean)
    .map((p) => String(p).replace(/^##\s*/, ""))
    .join("\n");

/** Content men can see → searchable documents. */
export function docsFromItems(items: ContentItem[]): KitoDoc[] {
  return items.map((c) => {
    const a = c.action;
    const en = join(
      c.summary,
      a?.need?.map((n) => `• ${n}`),
      a?.steps.map((s, i) => `${i + 1}. ${s.title ? `${s.title}: ` : ""}${s.text}`),
      a?.why,
      c.keyPoints,
      c.question,
      c.body,
    );
    const sw = join(
      c.summarySw,
      a?.needSw?.map((n) => `• ${n}`),
      a?.steps.map((s, i) => `${i + 1}. ${s.titleSw ? `${s.titleSw}: ` : ""}${s.textSw}`),
      a?.whySw,
      c.bodySw,
    );
    return {
      id: c.id,
      kind: a ? "card" : "guide",
      title: c.title,
      titleSw: c.titleSw,
      href: `/social/c/${c.id}`,
      text: join(c.title, c.titleSw, c.title, c.titleSw, c.tags, en, sw),
      en,
      sw: sw || en,
    };
  });
}

interface LessonLike {
  id: string;
  code?: string;
  title: string;
  titleSw?: string;
  body?: string[];
  bodySw?: string[];
}
/** Course lessons → documents (audio lessons only have their title, reading lessons their text too). */
export function docsFromLessons(courseTitle: string, lessons: LessonLike[]): KitoDoc[] {
  return lessons.map((l) => {
    const en = join(`${courseTitle} · ${l.code ? `${l.code} ` : ""}${l.title}`, l.body);
    const sw = join(`${courseTitle} · ${l.code ? `${l.code} ` : ""}${l.titleSw ?? l.title}`, l.bodySw ?? l.body);
    return {
      id: `lesson:${l.id}`,
      kind: "lesson",
      title: l.title,
      titleSw: l.titleSw,
      href: `/man/course/${l.id}`,
      text: join(l.title, l.titleSw, l.title, l.titleSw, courseTitle, l.body, l.bodySw),
      en,
      sw,
    };
  });
}

export interface Index {
  docs: KitoDoc[];
  tf: Map<string, number>[];
  len: number[];
  df: Map<string, number>;
  avg: number;
}

export function buildIndex(docs: KitoDoc[]): Index {
  const df = new Map<string, number>();
  const tf = docs.map((d) => {
    const m = new Map<string, number>();
    for (const w of tokens(d.text)) m.set(w, (m.get(w) ?? 0) + 1);
    for (const w of m.keys()) df.set(w, (df.get(w) ?? 0) + 1);
    return m;
  });
  const len = tf.map((m) => [...m.values()].reduce((s, n) => s + n, 0));
  return { docs, tf, len, df, avg: len.reduce((s, n) => s + n, 0) / Math.max(1, len.length) };
}

/** Best matches for a question, best first. Words from the question count fully; words that mean the same, half. */
export function search(index: Index, question: string, k = 6): Hit[] {
  const asked = new Set(tokens(question));
  const weight = new Map<string, number>();
  for (const w of asked) {
    weight.set(w, 1);
    const g = GROUP.get(w);
    if (g !== undefined) for (const s of SAME[g]) if (!asked.has(s)) weight.set(s, Math.max(weight.get(s) ?? 0, 0.5));
  }
  if (!weight.size) return [];
  const N = index.docs.length;
  const k1 = 1.4;
  const b = 0.7;
  const hits: Hit[] = [];
  index.tf.forEach((m, i) => {
    let score = 0;
    let direct = 0;
    for (const [w, wt] of weight) {
      const f = m.get(w);
      if (!f) continue;
      const n = index.df.get(w) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += wt * idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * index.len[i]) / index.avg)));
      if (wt === 1) direct++;
    }
    // A match only through "same meaning" words is weaker
    if (score > 0) hits.push({ doc: index.docs[i], score: direct ? score : score * 0.6 });
  });
  hits.sort((x, y) => y.score - x.score);
  const best = hits[0]?.score ?? 0;
  // Keep only real matches: a minimum score, and not far below the best one
  return hits.filter((h) => h.score >= 5.5 && h.score >= best * 0.4).slice(0, k);
}

/** The words Kito may use from one source, in his language first, kept short. */
export function excerpt(d: KitoDoc, lang: "en" | "sw", max = 1400): string {
  const main = lang === "sw" ? d.sw : d.en;
  const other = lang === "sw" ? d.en : d.sw;
  const text = main.length >= 120 || !other ? main : `${main}\n${other}`;
  return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")} …` : text;
}

/** Step 90: he asked from a card ("Ask Kito" on it): that card comes first, then the other matches. */
export function pinAbout(index: Index, aboutId: string | null | undefined, hits: Hit[], k = 6): Hit[] {
  if (!aboutId) return hits;
  const doc = index.docs.find((d) => d.id === aboutId);
  if (!doc) return hits;
  const top = Math.max(10, hits[0]?.score ?? 0);
  return [{ doc, score: top + 1 }, ...hits.filter((h) => h.doc.id !== aboutId)].slice(0, k);
}
