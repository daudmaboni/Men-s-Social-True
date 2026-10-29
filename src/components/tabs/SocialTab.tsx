"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bookmark, Search } from "lucide-react";
import Discover, { DiscoverSkeleton } from "@/components/social/Discover";
import Community from "@/components/social/Community";
import JourneyHome from "@/components/journey/JourneyHome";
import SearchPanel from "@/components/social/SearchPanel";
import ContentLangOffer from "@/components/social/ContentLangOffer";
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

// Step 100: My Journey is the first section (and where the app opens). Discover and Community are unchanged,
// one tap away, and ?tab=discover / ?tab=community still open them directly.
type Tab = "journey" | "discover" | "community";
const ORDER: Tab[] = ["journey", "discover", "community"];
const fromAddress = (v: string | null): Tab | null => (v === "journey" || v === "discover" || v === "community" ? v : null);

function SocialInner() {
  // Opens on My Journey, or on the section the address names (?tab=discover / ?tab=community, e.g. a shared
  // link); after that it's remembered while he moves between the main tabs (this tab stays open in the background).
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(fromAddress(params.get("tab")) ?? "journey");
  const [searching, setSearching] = useState(false);
  // Which way the content glides when switching (Community is to the right of Discover)
  const [dir, setDir] = useState<"left" | "right" | null>(null);
  // The address can switch the section: ?tab=community (back from a post) or ?tab=discover (after signing out)
  const wanted = fromAddress(params.get("tab"));
  useEffect(() => {
    if (wanted) {
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
      {/* Step 100: three sections don't fit beside the buttons on a phone, so: the title with Inbox, Search and
          Saved on top, and My plan / Discover / Community across the full width below it */}
      <header className="edge-pad flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-extrabold">{t("Social")}</h1>
          <div className="flex shrink-0 gap-2">
            <InboxButton />
            <button
              aria-label={t("Search")}
              aria-pressed={searching && tab !== "journey"}
              onClick={() => {
                // Search looks through Discover and Community; from My plan it opens Discover's search
                if (tab === "journey") {
                  setDir("left");
                  setTab("discover");
                  setSearching(true);
                } else setSearching((s) => !s);
              }}
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
        </div>
        <div className="grid">
          <LiquidSegment
            label={t("Social sections")}
            value={tab}
            onChange={(next) => {
              if (next === tab) return;
              setDir(ORDER.indexOf(next) > ORDER.indexOf(tab) ? "left" : "right");
              setTab(next);
            }}
            options={[
              { id: "journey", label: t("My plan") },
              { id: "discover", label: t("Discover") },
              { id: "community", label: t("Community") },
            ]}
          />
        </div>
      </header>

      <div
        id="social-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`} key={`${tab}-${searching}`}
        className={dir === "left" ? "glass-from-right" : dir === "right" ? "glass-from-left" : "page-enter"}
      >
        {tab === "journey" ? (
          <JourneyHome />
        ) : tab === "community" && communityLocked ? (
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
      {tab === "discover" && !searching && <ContentLangOffer />}
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
