"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";

/** A popup card over a dimmed, blurred background (like Fernly's "New project"). */
export default function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const t = useT();
  // Close with the Escape key, and stop the page behind from scrolling
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  // Rendered at the top of the page (portal) so it covers everything, including the bottom bar
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center px-5">
      <button
        aria-label={t("Close")}
        onClick={onClose}
        className="backdrop-in absolute inset-0 bg-ink/30 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || undefined}
        className="sheet-in relative max-h-[88dvh] w-full max-w-sm overflow-y-auto overscroll-contain rounded-3xl bg-surface p-5 shadow-xl"
      >
        <h2 className="text-lg font-bold">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
