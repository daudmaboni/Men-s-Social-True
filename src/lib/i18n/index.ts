"use client";

// Whole-app language switch. Every screen calls  const t = useT();  and writes  t("English text").
// In Kiswahili, the text is looked up in sw.ts (one place to correct any translation);
// anything missing falls back to English, so nothing ever shows blank.
//   t("{n} points", { n: 20 })  → fills in values.

import { createContext, createElement, useContext, useMemo } from "react";
import { useLang, type Lang } from "../me/lang";
import { makeT, type T } from "./translate";

export { makeT, translate, type T, type Vars } from "./translate";

const Override = createContext<Lang | null>(null);

/** Show part of the screen in another language (e.g. the admin's phone preview) without changing the app setting. */
export function LangOverride({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return createElement(Override.Provider, { value: lang }, children);
}

export function useT(): T {
  const appLang = useLang();
  const forced = useContext(Override);
  const lang = forced ?? appLang;
  return useMemo(() => makeT(lang), [lang]);
}
