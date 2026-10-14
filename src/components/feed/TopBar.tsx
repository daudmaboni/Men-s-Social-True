"use client";

import { ShoppingBag } from "lucide-react";
import InboxButton from "@/components/notifications/InboxButton";
import { useToast } from "@/components/motion/Toast";
import { useT } from "@/lib/i18n";

export default function TopBar() {
  const showToast = useToast();
  const t = useT();
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-sm font-bold text-mint">MS</div>
        <span className="text-base font-semibold">Men&apos;s Social</span>
      </div>
      <div className="flex gap-2">
        <button
          aria-label={t("Shop")}
          onClick={() => showToast(t("The shop is coming soon"))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface ring-1 ring-line transition-transform active:scale-95"
        >
          <ShoppingBag size={18} />
        </button>
        <InboxButton />
      </div>
    </header>
  );
}
