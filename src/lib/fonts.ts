"use client";

// Font style and text size (Step 66). Men choose on Me → Settings → Appearance; staff choose in the Studio's
// account menu. Each side keeps its own choice on this phone/computer:
//   app:    "ms_font", "ms_size"
//   studio: "ms_admin_font", "ms_admin_size"
// The page reads them before it paints (see themeBoot.ts), so there's no flash of the wrong font.
// The font files live in /public/fonts (Latin letters, which covers English and Kiswahili) and only the
// chosen one is downloaded. All are free fonts (SIL Open Font License).

import { useSyncExternalStore } from "react";

export type FontKind = "brand" | "sans" | "rounded" | "serif" | "system";
export interface FontChoice {
  id: string;
  name: string;
  kind: FontKind;
  /** CSS font-family for previews; the page itself uses the same stack through [data-font]. */
  stack: string;
}

const sans = "system-ui, sans-serif";
const serif = "Georgia, 'Times New Roman', serif";

export const FONTS: FontChoice[] = [
  { id: "kayani", name: "Kayani", kind: "brand", stack: `"Plus Jakarta Sans Variable", ${sans}` },
  { id: "system", name: "Phone default", kind: "system", stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` },
  { id: "inter", name: "Inter", kind: "sans", stack: `"MS Inter", ${sans}` },
  { id: "roboto", name: "Roboto", kind: "sans", stack: `"MS Roboto", ${sans}` },
  { id: "open-sans", name: "Open Sans", kind: "sans", stack: `"MS Open Sans", ${sans}` },
  { id: "noto-sans", name: "Noto Sans", kind: "sans", stack: `"MS Noto Sans", ${sans}` },
  { id: "source-sans-3", name: "Source Sans", kind: "sans", stack: `"MS Source Sans 3", ${sans}` },
  { id: "dm-sans", name: "DM Sans", kind: "sans", stack: `"MS DM Sans", ${sans}` },
  { id: "manrope", name: "Manrope", kind: "sans", stack: `"MS Manrope", ${sans}` },
  { id: "figtree", name: "Figtree", kind: "sans", stack: `"MS Figtree", ${sans}` },
  { id: "outfit", name: "Outfit", kind: "sans", stack: `"MS Outfit", ${sans}` },
  { id: "onest", name: "Onest", kind: "sans", stack: `"MS Onest", ${sans}` },
  { id: "urbanist", name: "Urbanist", kind: "sans", stack: `"MS Urbanist", ${sans}` },
  { id: "sora", name: "Sora", kind: "sans", stack: `"MS Sora", ${sans}` },
  { id: "work-sans", name: "Work Sans", kind: "sans", stack: `"MS Work Sans", ${sans}` },
  { id: "montserrat", name: "Montserrat", kind: "sans", stack: `"MS Montserrat", ${sans}` },
  { id: "raleway", name: "Raleway", kind: "sans", stack: `"MS Raleway", ${sans}` },
  { id: "lexend", name: "Lexend", kind: "sans", stack: `"MS Lexend", ${sans}` },
  { id: "nunito", name: "Nunito", kind: "rounded", stack: `"MS Nunito", ${sans}` },
  { id: "rubik", name: "Rubik", kind: "rounded", stack: `"MS Rubik", ${sans}` },
  { id: "quicksand", name: "Quicksand", kind: "rounded", stack: `"MS Quicksand", ${sans}` },
  { id: "lora", name: "Lora", kind: "serif", stack: `"MS Lora", ${serif}` },
  { id: "merriweather", name: "Merriweather", kind: "serif", stack: `"MS Merriweather", ${serif}` },
  { id: "literata", name: "Literata", kind: "serif", stack: `"MS Literata", ${serif}` },
  { id: "source-serif-4", name: "Source Serif", kind: "serif", stack: `"MS Source Serif 4", ${serif}` },
  { id: "playfair-display", name: "Playfair Display", kind: "serif", stack: `"MS Playfair Display", ${serif}` },
];
export const FONT_IDS = FONTS.map((f) => f.id);
export const DEFAULT_FONT = "kayani";

/** Group headings, in the order shown. */
export const FONT_GROUPS: { kinds: FontKind[]; heading: string }[] = [
  { kinds: ["brand", "system"], heading: "Recommended" },
  { kinds: ["sans"], heading: "Clean" },
  { kinds: ["rounded"], heading: "Rounded" },
  { kinds: ["serif"], heading: "Classic (serif)" },
];

export type TextSize = "sm" | "md" | "lg" | "xl" | "xxl" | "x3" | "x4";
/** `bigger`: the reading-help sizes (Step 96). Apple asks that text can grow to at least 200%. */
export const TEXT_SIZES: { id: TextSize; heading: string; percent: number; bigger?: boolean }[] = [
  { id: "sm", heading: "Small", percent: 90 },
  { id: "md", heading: "Normal", percent: 100 },
  { id: "lg", heading: "Large", percent: 112.5 },
  { id: "xl", heading: "Extra large", percent: 125 },
  { id: "xxl", heading: "Bigger", percent: 150, bigger: true },
  { id: "x3", heading: "Very big", percent: 175, bigger: true },
  { id: "x4", heading: "Biggest", percent: 200, bigger: true },
];
const SIZE_IDS = TEXT_SIZES.map((z) => z.id) as string[];

export type Scope = "app" | "studio";
export const fontKey = (s: Scope) => (s === "studio" ? "ms_admin_font" : "ms_font");
export const sizeKey = (s: Scope) => (s === "studio" ? "ms_admin_size" : "ms_size");

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

export const readFont = (s: Scope): string => {
  const v = read(fontKey(s));
  return v && FONT_IDS.includes(v) ? v : DEFAULT_FONT;
};
export const readSize = (s: Scope): TextSize => {
  const v = read(sizeKey(s));
  return v && SIZE_IDS.includes(v) ? (v as TextSize) : "md";
};

/** Which side of the app this page belongs to. */
export const scopeOfPath = (path: string): Scope => (path.startsWith("/studio") ? "studio" : "app");

function applyHere(s: Scope) {
  if (typeof document === "undefined" || scopeOfPath(location.pathname) !== s) return;
  const root = document.documentElement;
  const f = readFont(s);
  const z = readSize(s);
  if (f === DEFAULT_FONT) delete root.dataset.font;
  else root.dataset.font = f;
  if (z === "md") delete root.dataset.size;
  else root.dataset.size = z;
}

export function setFont(s: Scope, id: string) {
  write(fontKey(s), id === DEFAULT_FONT || !FONT_IDS.includes(id) ? null : id);
  applyHere(s);
  listeners.forEach((l) => l());
}
export function setTextSize(s: Scope, size: TextSize) {
  write(sizeKey(s), size === "md" ? null : size);
  applyHere(s);
  listeners.forEach((l) => l());
}

/** Moving between the app and the Studio in one tab: put on that side's choice. */
export function applyScope(path: string) {
  applyHere(scopeOfPath(path));
}

export function useFont(s: Scope): string {
  return useSyncExternalStore(subscribe, () => readFont(s), () => DEFAULT_FONT);
}
export function useTextSize(s: Scope): TextSize {
  return useSyncExternalStore(subscribe, () => readSize(s), () => "md" as TextSize);
}
export const fontById = (id: string) => FONTS.find((f) => f.id === id) ?? FONTS[0];
