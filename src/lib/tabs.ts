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
 * The glass bubble follows the strip: position 0–2 (1.5 = halfway between Man and Me).
 * It stretches sideways while between tabs, like a drop of liquid, and is round again when it lands.
 */
export function bubbleShape(position: number): { x: number; stretch: number } {
  const x = Math.min(Math.max(position, 0), TAB_PATHS.length - 1);
  const between = x - Math.floor(x);
  return { x, stretch: 1 + 0.22 * Math.sin(Math.PI * between) };
}
