"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bookmark, Search } from "lucide-react";
import Discover, { DiscoverSkeleton } from "@/components/social/Discover";
import Community from "@/components/social/Community";
import SearchPanel from "@/components/social/SearchPanel";
import LiquidSegment from "@/components/LiquidSegment";
import LockedTab from "@/components/account/LockedTab";
import { useAccount } from "@/lib/account/useAccount";
import { useT } from "@/lib/i18n";
import InboxButton from "@/components/notifications/InboxButton";
import PullToRefresh from "@/components/motion/PullToRefresh";
import { refreshLibrary } from "@/lib/content/useLibrary";
import { newVisit } from "@/lib/social/discoverPrefs";
import { refreshCommunity } from "@/lib/social/communityServer";

/** Pull to refresh (Step 77): Discover fetches new content and starts a fresh order; Community reloads the posts. */
const refreshDiscover = () => {
  newVisit();
  return refreshLibrary();
};

type Tab = "discover" | "community";

function SocialInner() {
  // Opens on Community when the address says ?tab=community (e.g. a shared link); after that it's
  // remembered while he moves between the main tabs, because this tab stays open in the background.
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get("tab") === "community" ? "community" : "discover");
  const [searching, setSearching] = useState(false);
  // Which way the content glides when switching (Community is to the right of Discover)
  const [dir, setDir] = useState<"left" | "right" | null>(null);
  // The address can switch the section: ?tab=community (back from a post) or ?tab=discover (after signing out)
  const wanted = params.get("tab");
  useEffect(() => {
    if (wanted === "community" || wanted === "discover") {
      setTab(wanted);
      setSearching(false);
    }
  }, [wanted]);
  // Community needs an account (anonymous posting still works, but we need to know who to moderate)
  const acc = useAccount();
  const communityLocked = acc.status === "guest";
  const t = useT();

  return (
    <div className="space-y-5">
      {/* One row: Discover / Community on the left, Search and Saved on the right */}
      <header className="flex items-center justify-between gap-2">
        <h1 className="sr-only">{t("Social")}</h1>
        <LiquidSegment
          label={t("Social sections")}
          value={tab}
          onChange={(t) => {
            if (t === tab) return;
            setDir(t === "community" ? "left" : "right");
            setTab(t);
          }}
          options={[
            { id: "discover", label: t("Discover") },
            { id: "community", label: t("Community") },
          ]}
        />
        <div className="flex shrink-0 gap-2">
          <InboxButton />
          <button
            aria-label={t("Search")}
            aria-pressed={searching}
            onClick={() => setSearching((s) => !s)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface ring-1 ring-line transition-transform active:scale-95"
          >
            <Search size={18} />
          </button>
          <Link
            href="/social/saved"
            aria-label={t("Saved")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface ring-1 ring-line transition-transform active:scale-95"
          >
            <Bookmark size={18} />
          </Link>
        </div>
      </header>

      <div
        id="social-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`} key={`${tab}-${searching}`}
        className={dir === "left" ? "glass-from-right" : dir === "right" ? "glass-from-left" : "page-enter"}
      >
        {tab === "community" && communityLocked ? (
          <LockedTab tab="community" />
        ) : searching ? (
          <SearchPanel tab={tab} onClose={() => setSearching(false)} />
        ) : tab === "discover" ? (
          <PullToRefresh onRefresh={refreshDiscover}>
            <Discover />
          </PullToRefresh>
        ) : (
          <PullToRefresh onRefresh={refreshCommunity}>
            <Community />
          </PullToRefresh>
        )}
      </div>
    </div>
  );
}

export default function SocialTab() {
  return (
    <Suspense fallback={<DiscoverSkeleton />}>
      <SocialInner />
    </Suspense>
  );
}
