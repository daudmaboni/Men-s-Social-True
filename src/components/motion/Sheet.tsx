"use client";

// Pop-ups (Step 77).
// - Phones: a bottom sheet, like WhatsApp and Instagram. It rises from the bottom, has a handle, and a pull
//   down (or a flick) closes it. While a list inside it is scrolled, the list scrolls first.
// - Computers, and pop-ups marked `anchored` (the notifications list): a card that grows out of the button
//   he pressed and shrinks back into it when it closes.
// - However it closes (pull, tap outside, Escape, a button inside), it leaves the way it came in.
// Everything moves on springs; "reduce motion" makes it appear and go at once.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { animateSpring, type SpringHandle } from "@/lib/motion/spring";
import { pullCloses, useSheetDrag } from "@/lib/motion/useSheetDrag";
import { lastTrigger, originWithin } from "@/lib/motion/origin";

const isPhone = () => typeof window !== "undefined" && !!window.matchMedia?.("(max-width: 1023px)").matches;

export default function Sheet({
  open,
  onClose,
  title,
  anchored = false,
  above = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Grow out of the button that opened it, on phones too (for small lists like notifications). */
  anchored?: boolean;
  /** Over full-screen layers like the reels viewer (Step 86). */
  above?: boolean;
  children: React.ReactNode;
}) {
  const t = useT();
  const [mounted, setMounted] = useState(open);
  const [mode, setMode] = useState<"bottom" | "pop">(() => (isPhone() && !anchored ? "bottom" : "pop"));
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLButtonElement>(null);
  const anim = useRef<SpringHandle | null>(null);
  const y = useRef(0); // bottom sheet: how far below its resting place (px)
  const p = useRef(0); // pop card: 0 = shrunk into the button, 1 = fully open
  const flick = useRef(0); // speed of the pull that closed it, handed to the closing spring
  const from = useRef<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode(isPhone() && !anchored ? "bottom" : "pop");
    setMounted(true);
  }, [open, anchored]);

  const height = () => panel.current?.offsetHeight || 400;

  const placeBottom = useCallback((v: number) => {
    y.current = v;
    const el = panel.current;
    if (el) el.style.transform = v ? `translate3d(0, ${v}px, 0)` : "";
    if (scrim.current) scrim.current.style.opacity = String(Math.max(0, Math.min(1, 1 - v / (el?.offsetHeight || 400))));
  }, []);
  const placePop = useCallback((v: number) => {
    p.current = v;
    const el = panel.current;
    if (el) {
      el.style.transform = v >= 1 ? "" : `scale(${0.5 + 0.5 * v})`;
      el.style.opacity = String(Math.max(0, Math.min(1, v * 1.6)));
    }
    if (scrim.current) scrim.current.style.opacity = String(Math.max(0, Math.min(1, v)));
  }, []);

  // Opening: choose the kind, then rise from the bottom or grow out of the button
  useLayoutEffect(() => {
    if (!mounted || !open) return;
    const kind = mode;
    const el = panel.current;
    if (!el) return;
    anim.current?.stop();
    if (kind === "bottom") {
      el.style.transformOrigin = "";
      placeBottom(y.current || height() + 40);
      anim.current = animateSpring(y.current, 0, placeBottom, { damping: 1, response: 0.36 });
    } else {
      from.current = lastTrigger();
      el.style.transformOrigin = originWithin(el.getBoundingClientRect(), from.current);
      placePop(p.current || 0);
      anim.current = animateSpring(p.current, 1, placePop, { damping: 0.86, response: 0.3 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, open, mode]);

  // Closing (by any route): leave the way it came, then unmount
  useEffect(() => {
    if (open || !mounted) return;
    anim.current?.stop();
    const done = () => {
      anim.current = null;
      flick.current = 0;
      y.current = 0;
      p.current = 0;
      setMounted(false);
    };
    if (mode === "bottom") {
      anim.current = animateSpring(y.current, height() + 40, placeBottom, { damping: 1, response: 0.3, velocity: Math.max(0, flick.current), onDone: done, restDelta: 2 });
    } else {
      anim.current = animateSpring(p.current, 0, placePop, { damping: 1, response: 0.22, onDone: done, restDelta: 0.02 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close with the Escape key, and stop the page behind from scrolling
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mounted, onClose]);

  // Pull down to close (bottom sheets only)
  const onDrag = useCallback(
    (v: number) => {
      anim.current?.stop();
      placeBottom(v);
    },
    [placeBottom],
  );
  const onRelease = useCallback(
    (v: number, velocity: number) => {
      if (pullCloses(v, velocity, height())) {
        flick.current = velocity;
        onClose();
      } else {
        anim.current = animateSpring(y.current, 0, placeBottom, { damping: 1, response: 0.3, velocity });
      }
    },
    [onClose, placeBottom],
  );
  useSheetDrag(panel, { enabled: mounted && open && mode === "bottom", onDrag, onRelease });

  if (!mounted || typeof document === "undefined") return null;
  const bottom = mode === "bottom";

  // Rendered at the top of the page (portal) so it covers everything, including the bottom bar
  return createPortal(
    <div
      className={`fixed inset-0 ${above ? "z-[70]" : "z-40"} flex justify-center ${
        bottom ? "items-end" : "items-center px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
      }`}
    >
      <button ref={scrim} aria-label={t("Close")} onClick={onClose} style={{ opacity: 0 }} className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title || undefined}
        style={bottom ? { transform: "translate3d(0,110%,0)" } : { opacity: 0 }}
        className={`relative w-full overflow-y-auto overscroll-contain bg-surface shadow-xl will-change-transform ${
          bottom
            ? "max-h-[90dvh] rounded-t-[28px] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2"
            : "max-h-full max-w-sm rounded-3xl p-5"
        }`}
      >
        {bottom && (
          // The handle: a hint that it can be pulled down
          <div className="sticky top-0 z-10 -mx-5 mb-1 flex justify-center bg-surface pb-2 pt-1" aria-hidden>
            <span className="h-1.5 w-10 rounded-full bg-line" />
          </div>
        )}
        <h2 className="text-lg font-bold">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
