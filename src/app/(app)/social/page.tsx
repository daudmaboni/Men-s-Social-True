"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark, Search } from "lucide-react";
import Discover, { DiscoverSkeleton } from "@/components/social/Discover";
import Community from "@/components/social/Community";
import SearchPanel from "@/components/social/SearchPanel";

type Tab = "discover" | "community";

function SocialInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: Tab = params.get("tab") === "community" ? "community" : "discover";
  const [searching, setSearching] = useState(false);

  // Switching tabs keeps him on /social; the tab is remembered in the address for Back
  const setTab = (t: Tab) => router.replace(t === "discover" ? pathname : `${pathname}?tab=${t}`, { scroll: false });

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-[28px] font-bold leading-none">Social</h1>
        <div className="flex gap-2">
          <button
            aria-label="Search"
            aria-pressed={searching}
            onClick={() => setSearching((s) => !s)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface ring-1 ring-line transition-transform active:scale-95"
          >
            <Search size={18} />
          </button>
          <Link
            href="/social/saved"
            aria-label="Saved"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface ring-1 ring-line transition-transform active:scale-95"
          >
            <Bookmark size={18} />
          </Link>
        </div>
      </header>

      <div className="inline-flex rounded-full bg-surface p-1 ring-1 ring-line" role="tablist" aria-label="Social sections">
        {(["discover", "community"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls="social-panel"
            onClick={() => setTab(t)}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              tab === t ? "bg-forest-deep text-white" : "text-ink-soft"
            }`}
          >
            {t === "discover" ? "Discover" : "Community"}
          </button>
        ))}
      </div>

      <div id="social-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} key={`${tab}-${searching}`} className="page-enter">
        {searching ? (
          <SearchPanel tab={tab} onClose={() => setSearching(false)} />
        ) : tab === "discover" ? (
          <Discover />
        ) : (
          <Community />
        )}
      </div>
    </div>
  );
}

export default function SocialPage() {
  return (
    <Suspense fallback={<DiscoverSkeleton />}>
      <SocialInner />
    </Suspense>
  );
}
