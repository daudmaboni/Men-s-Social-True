"use client";

// Step 96: keyboard and screen-reader focus for pop-ups (Apple HIG, Accessibility and Modality).
// - When a pop-up opens, focus moves into it, so a screen reader reads the pop-up, not the page behind.
// - While it is open, Tab and Shift+Tab stay inside it.
// - When it closes, focus goes back to the button that opened it.
// Touch users see no difference.

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/** Everything inside `root` that Tab can reach, in order (hidden ones left out). */
export function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest("[inert]") && el.getAttribute("aria-hidden") !== "true" && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0),
  );
}

/**
 * @param ref    the pop-up's box (the element with role="dialog")
 * @param active true while the pop-up is showing
 * @param initial optional: the element to focus first (otherwise the box itself, so the title is read first)
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, active: boolean, initial?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return;
    const box = ref.current;
    if (!box) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // The box itself can take focus (without showing a ring), so the dialog's name is announced first
    if (!box.hasAttribute("tabindex")) box.setAttribute("tabindex", "-1");
    const first = initial?.current;
    // Wait a frame: the pop-up may still be placing itself
    const raf = requestAnimationFrame(() => {
      if (!box.contains(document.activeElement)) (first ?? box).focus({ preventScroll: true });
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusablesIn(box);
      if (items.length === 0) {
        e.preventDefault();
        box.focus({ preventScroll: true });
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const now = document.activeElement;
      if (e.shiftKey && (now === firstEl || now === box || !box.contains(now))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && (now === lastEl || !box.contains(now))) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      // Back to where he was, if that button is still on the page
      if (opener && opener.isConnected && typeof opener.focus === "function") opener.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
