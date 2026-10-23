"use client";

// Offline learning (Step 67), mounted once in the app:
//  - starts the service worker (in the live app; in development only with localStorage ms_sw = "1"),
//  - gets downloaded lessons ready for the player,
//  - shows a small bar: offline (what still works), then "back online · saving…" and "all saved".

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CheckCircle2, CloudUpload, WifiOff } from "lucide-react";
import { useAccount } from "@/lib/account/useAccount";
import { syncStatus } from "@/lib/account/sync";
import { downloads } from "@/lib/offline/downloads";
import { useOnline } from "@/lib/offline/online";
import { useT } from "@/lib/i18n";
import { keepPushRegistered } from "@/lib/notifications/push";

function registerWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  let dev = false;
  try {
    dev = localStorage.getItem("ms_sw") === "1";
  } catch {}
  if (process.env.NODE_ENV !== "production" && !dev) return;
  void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
}

export default function OfflineSupport() {
  const t = useT();
  const online = useOnline();
  const acc = useAccount();
  const sync = useSyncExternalStore(syncStatus.subscribe, syncStatus.get, syncStatus.get);
  const wasOffline = useRef(false);
  const [back, setBack] = useState<"saving" | "saved" | "retry" | null>(null);
  // Offline: the full message for a few seconds, then a small pill (tap it to read again)
  const [small, setSmall] = useState(false);
  useEffect(() => {
    if (online) return;
    setSmall(false);
    const id = setTimeout(() => setSmall(true), 6000);
    return () => clearTimeout(id);
  }, [online]);

  useEffect(() => {
    registerWorker();
    downloads.get(); // lessons on the phone are handed to the player
  }, []);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setBack(null);
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setBack(acc.status === "signedIn" ? "saving" : "saved");
  }, [online, acc.status]);

  // Phone notifications (Step 79): on each open, make sure this phone is still registered to him
  useEffect(() => {
    if (acc.status === "signedIn") void keepPushRegistered();
  }, [acc.status]);

  // After coming back: "saving" until his account has everything, then "saved" for a moment
  useEffect(() => {
    if (back === "saving" && (sync.status === "saved" || sync.status === "idle")) setBack("saved");
    if (back === "saving" && sync.status === "error") setBack("retry");
    if (back === "saved" || back === "retry") {
      const id = setTimeout(() => setBack(null), 3500);
      return () => clearTimeout(id);
    }
  }, [back, sync.status]);

  if (online && !back) return null;
  const signedIn = acc.status === "signedIn";
  if (!online && small)
    return (
      <button
        type="button"
        onClick={() => setSmall(false)}
        className="fixed right-3 top-[max(0.5rem,env(safe-area-inset-top))] z-50 flex items-center gap-1.5 rounded-full bg-forest-deep px-3 py-1.5 text-[0.6875rem] font-bold text-white shadow-lg"
        aria-label={t("You're offline.")}
      >
        <WifiOff size={13} className="text-mint" /> {t("Offline")}
      </button>
    );
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(0.5rem,env(safe-area-inset-top))]" role="status" aria-live="polite">
      <div className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-2xl bg-forest-deep px-4 py-2.5 text-white shadow-xl">
        {!online ? (
          <>
            <WifiOff size={16} className="mt-0.5 shrink-0 text-mint" />
            <p className="text-xs leading-snug">
              <span className="font-bold">{t("You're offline.")}</span>{" "}
              {t(signedIn ? "Your changes are kept on this phone and saved to your account when you're back." : "Your changes are kept on this phone.")}{" "}
              <Link href="/me/downloads" className="font-semibold text-mint underline underline-offset-2">
                {t("My downloads")}
              </Link>
            </p>
          </>
        ) : back === "retry" ? (
          <>
            <CloudUpload size={16} className="mt-0.5 shrink-0 text-mint" />
            <p className="text-xs font-semibold">{t("Not saved to your account yet. It will try again by itself.")}</p>
          </>
        ) : back === "saving" ? (
          <>
            <CloudUpload size={16} className="mt-0.5 shrink-0 animate-pulse text-mint" />
            <p className="text-xs font-semibold">{t("Back online. Saving your changes…")}</p>
          </>
        ) : (
          <>
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-mint" />
            <p className="text-xs font-semibold">{t(signedIn ? "Back online. Everything is saved." : "Back online.")}</p>
          </>
        )}
      </div>
    </div>
  );
}
