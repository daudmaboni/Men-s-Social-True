// The three main tabs, in order. Used by the tab pager and the tab bar.

export const TAB_PATHS = ["/social", "/man", "/me"] as const;

/** Which tab a page belongs to (for highlighting the tab bar). */
export function tabFor(pathname: string): number {
  if (pathname.startsWith("/social")) return 0;
  if (pathname.startsWith("/man") || pathname.startsWith("/learn")) return 1;
  if (pathname.startsWith("/me") || pathname.startsWith("/account")) return 2;
  return -1;
}

/** The main page of a tab (shown in the sliding strip). Anything else opens on top of it. */
export function isTabRoot(pathname: string): boolean {
  return (TAB_PATHS as readonly string[]).includes(pathname);
}


/**
 * Where the sliding strip of tabs is right now (0–2, fractions while moving).
 * The pager writes it; the Liquid Glass tab bar reads it every frame. No React re-renders involved.
 */
let stripPos = 0;
const stripListeners = new Set<(pos: number, byFinger: boolean) => void>();
export const stripPosition = {
  get: () => stripPos,
  /** byFinger: true while he's swiping the pages (the glass then follows the finger exactly). */
  set(pos: number, byFinger = false) {
    stripPos = pos;
    stripListeners.forEach((l) => l(pos, byFinger));
  },
  subscribe(cb: (pos: number, byFinger: boolean) => void) {
    stripListeners.add(cb);
    return () => {
      stripListeners.delete(cb);
    };
  },
};

/**
 * The page each tab was left on (e.g. Man → /man/course/wz-2-0), so coming back to the tab opens it again.
 * Kept for this visit only (sessionStorage), so a fresh start always opens the tabs at their top.
 */
const MEMORY_KEY = "ms_tab_memory";
function readMemory(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(MEMORY_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}
function writeMemory(m: Record<string, string>) {
  try {
    sessionStorage.setItem(MEMORY_KEY, JSON.stringify(m));
  } catch {}
}
export const tabMemory = {
  remember(tab: number, path: string) {
    writeMemory({ ...readMemory(), [tab]: path });
  },
  /** The remembered page for this tab, and forget it (it's being opened now). */
  take(tab: number): string | null {
    const m = readMemory();
    const path = m[tab] ?? null;
    if (path) {
      delete m[tab];
      writeMemory(m);
    }
    return path;
  },
  forget(tab: number) {
    const m = readMemory();
    if (m[tab]) {
      delete m[tab];
      writeMemory(m);
    }
  },
};
