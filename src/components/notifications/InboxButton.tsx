"use client";

// The bell: his inbox of messages from the Men's Social team (only when signed in).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import Sheet from "@/components/motion/Sheet";
import { useToast } from "@/components/motion/Toast";
import { useAccount } from "@/lib/account/useAccount";
import { useT } from "@/lib/i18n";
import { markOpened, refreshInbox, useInbox, type InboxItem } from "@/lib/notifications/inbox";
import { timeAgo } from "@/lib/social/community";

export default function InboxButton() {
  const acc = useAccount();
  const inbox = useInbox();
  const t = useT();
  const router = useRouter();
  const showToast = useToast();
  const [open, setOpen] = useState(false);
  const signedIn = acc.status === "signedIn";

  useEffect(() => {
    if (!signedIn) return;
    void refreshInbox(true);
    const onShow = () => document.visibilityState === "visible" && void refreshInbox();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [signedIn]);

  const unread = inbox.items.filter((i) => !i.opened).length;
  const usable = signedIn && inbox.status !== "unavailable";

  function tap(i: InboxItem) {
    if (!i.opened) void markOpened(i.id);
    if (i.link) {
      setOpen(false);
      router.push(i.link);
    }
  }

  return (
    <>
      <button
        aria-label={unread ? t("Notifications ({n} new)", { n: unread }) : t("Notifications")}
        onClick={() => (usable ? (setOpen(true), void refreshInbox(true)) : showToast(t(signedIn ? "No notifications yet" : "Create a free account to get messages from the team")))}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface ring-1 ring-line transition-transform active:scale-95"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[0.625rem] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <Sheet anchored open={open} onClose={() => setOpen(false)} title={t("Notifications")}>
        {inbox.items.length === 0 ? (
          <p className="text-sm text-ink-soft">{t("No notifications yet")}</p>
        ) : (
          <ul className="-m-1 max-h-[60dvh] space-y-2 overflow-y-auto overscroll-contain p-1">
            {inbox.items.map((i) => (
              <li key={i.id}>
                <button onClick={() => tap(i)} className={`w-full rounded-2xl p-3 text-left ring-1 ${i.opened ? "ring-line" : "bg-mint/50 ring-mint-strong/40"} ${i.kind === "warning" ? "ring-amber-300" : ""}`}>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {!i.opened && <span className="h-2 w-2 shrink-0 rounded-full bg-forest" aria-label={t("New")} />}
                    {i.title}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-soft">{i.body}</p>
                  <p className="mt-1 text-[0.6875rem] text-ink-soft">{timeAgo(i.sent_at, new Date(), t.lang)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[0.6875rem] text-ink-soft">{t("Choose which messages you get on Me → Notifications.")}</p>
      </Sheet>
    </>
  );
}
