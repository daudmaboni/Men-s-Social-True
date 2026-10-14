// Pure translation helpers (no React), usable anywhere — including tests and helpers.

import type { Lang } from "../me/lang";
import { SW } from "./sw";

export type Vars = Record<string, string | number>;
export type T = ((en: string, vars?: Vars) => string) & { lang: Lang; locale: string };

const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s);

/** English text → his language. Anything not translated yet stays in English. */
export function translate(lang: Lang, en: string, vars?: Vars): string {
  return fill(lang === "sw" ? (SW[en] ?? en) : en, vars);
}

export function makeT(lang: Lang): T {
  const t = ((en: string, vars?: Vars) => translate(lang, en, vars)) as T;
  t.lang = lang;
  t.locale = lang === "sw" ? "sw-TZ" : "en-GB";
  return t;
}
