"use client";

// Studio → Homepage hands its unsaved changes to the Preview page (and gets them back when you return),
// so opening the preview never loses your edits. Kept for this browser tab only (sessionStorage).

import type { HomepageConfig } from "./config";

const KEY = "ms_homepage_work";
type Saved = { work: HomepageConfig; base: string };

/** Remember the changes being edited, and which saved layout they started from. */
export function keepWork(work: HomepageConfig, base: HomepageConfig) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ work, base: JSON.stringify(base) } satisfies Saved));
  } catch {}
}

/** The changes being edited — only if they still start from the same saved layout. */
export function takeWork(base?: HomepageConfig): HomepageConfig | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved;
    if (base && s.base !== JSON.stringify(base)) return null;
    return s.work;
  } catch {
    return null;
  }
}

/** After saving, publishing or discarding: nothing is waiting any more. */
export function clearWork() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}
