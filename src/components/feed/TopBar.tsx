"use client";

import { Bell, ShoppingBag } from "lucide-react";
import { useToast } from "@/components/motion/Toast";

export default function TopBar() {
  const showToast = useToast();
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-sm font-bold text-mint">MS</div>
        <span className="text-base font-semibold">Men&apos;s Social</span>
      </div>
      <div className="flex gap-2">
        <button
          aria-label="Shop"
          onClick={() => showToast("The shop is coming soon")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface ring-1 ring-line transition-transform active:scale-95"
        >
          <ShoppingBag size={18} />
        </button>
        <button
          aria-label="Notifications"
          onClick={() => showToast("No notifications yet")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface ring-1 ring-line transition-transform active:scale-95"
        >
          <Bell size={18} />
        </button>
      </div>
    </header>
  );
}
