"use client";

// Pop-ups grow out of what he tapped (Step 77): the notifications list out of the bell, a menu out of its button.
// We remember the last button or link he pressed (and when); a pop-up that opens straight after uses its
// position as the point it grows from, and shrinks back into it when it closes.

let last: { rect: DOMRect; at: number } | null = null;
let listening = false;

function listen() {
  if (listening || typeof document === "undefined") return;
  listening = true;
  document.addEventListener(
    "pointerdown",
    (e) => {
      const el = (e.target as Element | null)?.closest?.("button, a, [role=button], [role=menuitem]");
      if (el) last = { rect: el.getBoundingClientRect(), at: performance.now() };
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const el = document.activeElement;
      if (el && el !== document.body) last = { rect: el.getBoundingClientRect(), at: performance.now() };
    },
    true,
  );
}
listen();

/** Where the thing he just pressed is, if he pressed it within the last second. */
export function lastTrigger(): DOMRect | null {
  listen();
  if (!last || performance.now() - last.at > 1000) return null;
  return last.rect;
}

/** `transform-origin` for a box at `box` so that scaling it shrinks it into `from` (which may lie outside the box). */
export function originWithin(box: DOMRect, from: DOMRect | null): string {
  if (!from) return "50% 50%";
  const x = from.left + from.width / 2 - box.left;
  const y = from.top + from.height / 2 - box.top;
  return `${Math.round(x)}px ${Math.round(y)}px`;
}

/** Ref callback for a menu or popover: it grows out of the button that opened it. */
export function growFromTrigger(el: HTMLElement | null) {
  if (!el) return;
  el.style.transformOrigin = originWithin(el.getBoundingClientRect(), lastTrigger());
}
