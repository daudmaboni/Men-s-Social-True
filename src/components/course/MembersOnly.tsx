"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import LockedTab from "@/components/account/LockedTab";
import { useAccount } from "@/lib/account/useAccount";
import { useT } from "@/lib/i18n";

/** Course pages are part of the Man tab: guests see the same sign-up preview. */
export default function MembersOnly({ children }: { children: React.ReactNode }) {
  const acc = useAccount();
  const t = useT();
  if (acc.status === "loading") return <div className="h-64 animate-pulse rounded-3xl bg-surface ring-1 ring-line" />;
  if (acc.status === "guest")
    return (
      <div className="space-y-4">
        <Link href="/social" className="flex items-center gap-1 text-sm text-ink-soft">
          <ArrowLeft size={16} /> {t("Social")}
        </Link>
        <LockedTab tab="man" />
      </div>
    );
  return <>{children}</>;
}
