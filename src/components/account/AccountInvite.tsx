"use client";

// A friendly "create a free account" invite at the right moments, never more than once per moment:
// - first-save: he saved his first guide
// Only shown to guests. He can always say "Not now".

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import Sheet from "@/components/motion/Sheet";
import { useAccount } from "@/lib/account/useAccount";
import { useT } from "@/lib/i18n";

export type InviteReason = "first-save";
const EVENT = "ms-account-invite";
const seenKey = (r: InviteReason) => `ms_invite_${r}`;

const COPY: Record<InviteReason, { title: string; text: string }> = {
  "first-save": {
    title: "Saved for later",
    text: "Create a free account and your saved guides follow you to any phone.",
  },
};

/** Ask for the invite from anywhere. It only appears if he's a guest and hasn't seen it for this reason. */
export function inviteToAccount(reason: InviteReason) {
  try {
    if (localStorage.getItem(seenKey(reason))) return;
  } catch {
    return;
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: reason }));
}

/** Mounted once in the app layout. */
export default function AccountInviteSheet() {
  const acc = useAccount();
  const [reason, setReason] = useState<InviteReason | null>(null);
  const t = useT();

  useEffect(() => {
    if (acc.status !== "guest") return;
    const onInvite = (e: Event) => {
      const r = (e as CustomEvent<InviteReason>).detail;
      try {
        localStorage.setItem(seenKey(r), new Date().toISOString());
      } catch {}
      // Let the toast for what he just did show first
      setTimeout(() => setReason(r), 900);
    };
    window.addEventListener(EVENT, onInvite);
    return () => window.removeEventListener(EVENT, onInvite);
  }, [acc.status]);

  const copy = reason ? COPY[reason] : null;
  return (
    <Sheet open={reason !== null} onClose={() => setReason(null)} title={copy ? t(copy.title) : ""}>
      <div className="flex gap-3">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-forest" />
        <p className="text-sm text-ink-soft">{copy ? t(copy.text) : ""}</p>
      </div>
      <div className="mt-5 space-y-2">
        <Link
          href="/account?mode=signup"
          onClick={() => setReason(null)}
          className="block w-full rounded-full bg-forest py-3 text-center text-sm font-semibold text-white"
        >
          {t("Create free account")}
        </Link>
        <button onClick={() => setReason(null)} className="w-full py-2 text-sm font-semibold text-ink-soft">
          {t("Not now")}
        </button>
      </div>
    </Sheet>
  );
}
