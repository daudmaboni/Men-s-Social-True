"use client";

// Kito's floating button (Step 67): bottom right on every page of the app, like the chat helpers on other
// apps and websites. Tapping it opens Kito in a window: full screen on a phone, a panel in the corner on
// a computer. It sits above the bottom bar, and moves up when the lesson mini player is showing.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useMiniPlayerVisible } from "@/components/course/MiniPlayer";
import { useT } from "@/lib/i18n";
import KitoChat from "./KitoChat";
import KitoMark from "./KitoMark";

export default function KitoLauncher() {
  const t = useT();
  const pathname = usePathname() ?? "";
  const mini = useMiniPlayerVisible();
  const [open, setOpen] = useState(false);

  // Close with Escape, and when he goes to another page
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => setOpen(false), [pathname]);

  // Not on Kito's own page, the Studio or the sign-in screens
  if (pathname.startsWith("/social/kito") || pathname.startsWith("/studio") || pathname.startsWith("/account")) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("Ask Kito")}
          title={t("Ask Kito")}
          className={`kito-fab fixed right-4 z-30 flex items-center gap-2 rounded-full bg-surface p-1 shadow-xl ring-2 ring-forest transition-[bottom,transform] duration-300 active:scale-95 lg:right-6 lg:pr-4 ${
            mini
              ? "bottom-[calc(max(12px,env(safe-area-inset-bottom))+160px)] lg:bottom-[7.5rem]"
              : "bottom-[calc(max(12px,env(safe-area-inset-bottom))+88px)] lg:bottom-6"
          }`}
        >
          <KitoMark size={58} className="kito-wave ring-0" />
          <span className="hidden text-sm font-bold text-forest-deep lg:inline">{t("Ask Kito")}</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 lg:inset-auto lg:bottom-6 lg:right-6" role="dialog" aria-modal="true" aria-label="Kito">
          {/* Phone: dim the app behind; computer: just the panel */}
          <button className="absolute inset-0 bg-black/40 lg:hidden" aria-label={t("Close")} onClick={() => setOpen(false)} />
          <div className="kito-panel absolute inset-x-0 bottom-0 top-[max(1rem,env(safe-area-inset-top))] overflow-hidden rounded-t-[28px] bg-surface shadow-2xl ring-1 ring-line lg:static lg:h-[min(640px,calc(100dvh-3rem))] lg:w-[400px] lg:rounded-[28px]">
            <KitoChat onClose={() => setOpen(false)} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
