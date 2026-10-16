"use client";

import BrandMark from "@/components/brand/BrandMark";
import { ShoppingBag } from "lucide-react";
import InboxButton from "@/components/notifications/InboxButton";
import { useToast } from "@/components/motion/Toast";
import { useT } from "@/lib/i18n";

export default function TopBar() {
  const showToast = useToast();
  const t = useT();
  return (
    <header className="flex items-center justify-between">
      {/* On a computer the logo is already in the sidebar, so the page shows its name instead */}
      <h1 className="hidden text-2xl font-bold lg:block">{t("Man")}</h1>
      <div className="flex items-center gap-2 lg:hidden">
        <BrandMark size={36} />
        <span className="text-base font-semibold">Men&apos;s Social</span>
      </div>
      <div className="flex gap-2">
        <button
          aria-label={t("Shop")}
          onClick={() => showToast(t("The shop is coming soon"))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface ring-1 ring-line transition-transform active:scale-95 lg:hidden"
        >
          <ShoppingBag size={18} />
        </button>
        <InboxButton />
      </div>
    </header>
  );
}
