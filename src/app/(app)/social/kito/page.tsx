"use client";

// Kito on its own page (Step 67), for links like /social/kito. Everywhere else Kito opens from the
// floating button (KitoLauncher).

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import KitoChat from "@/components/kito/KitoChat";
import { useT } from "@/lib/i18n";

export default function KitoPage() {
  const t = useT();
  return (
    <div className="space-y-3">
      <Link href="/social" className="tap-target flex items-center gap-1 text-sm text-ink-soft">
        <ArrowLeft size={16} /> {t("Social")}
      </Link>
      <div className="h-[calc(100dvh-11rem)] overflow-hidden rounded-[28px] bg-surface ring-1 ring-line lg:h-[calc(100dvh-8rem)]">
        <KitoChat />
      </div>
    </div>
  );
}
