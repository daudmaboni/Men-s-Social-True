"use client";

// "Me": who he is in the app, what he's earned, his goals, settings and privacy controls.
// Everything here comes from his real activity on this phone.

import SyncPull from "@/components/motion/SyncPull";
import ProfileHero from "@/components/me/ProfileHero";
import BadgesSection from "@/components/me/BadgesSection";
import { GoalsCard, PrivacyCard, SettingsCard } from "@/components/me/SettingsSections";
import { useHomeFeed } from "@/components/feed/useHomeFeed";
import { useFeed } from "@/lib/feed/store";
import { computeBadges, firstActiveDay } from "@/lib/me/badges";
import { useLang } from "@/lib/me/lang";
import { goalFor, useProgress } from "@/lib/progress/store";
import { useSocial } from "@/lib/social/store";
import { useAccount } from "@/lib/account/useAccount";
import { accountLabel } from "@/lib/account/useAccount";
import { useT } from "@/lib/i18n";
import NotificationPrefs from "@/components/me/NotificationPrefs";

export default function MeTab() {
  const f = useHomeFeed();
  const feed = useFeed();
  const progress = useProgress();
  const social = useSocial();
  const lang = useLang();
  const acc = useAccount();
  const t = useT();

  if (!f.ready || !social.ready) {
    return (
      <div className="space-y-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0" aria-busy="true" aria-label={t("Loading")}>
        <div className="h-52 animate-pulse rounded-[28px] bg-forest-deep/15 lg:col-span-5" />
        <div className="h-64 animate-pulse rounded-3xl bg-surface ring-1 ring-line lg:col-span-7" />
      </div>
    );
  }

  const badges = computeBadges({
    records: progress.records,
    goals: progress.goals,
    feed,
    points: f.points,
    pointDays: f.pointDays,
    bookmarks: Object.keys(social.bookmarks).length,
    posts: social.posts.length,
    replies: social.replies.length,
  });

  // Pull down at the top: sync now (Step 78)
  return (
    <SyncPull>
    {/* Phone: one column. Computer: profile and badges on the left (they stay in view), goals and settings on the right. */}
    <div className="stagger flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
      <h1 className="sr-only">{t("Me")}</h1>
      <div className="contents lg:sticky lg:top-0 lg:col-span-5 lg:flex lg:flex-col lg:gap-5">
      <ProfileHero
        nickname={social.nickname}
        profile={social.profile}
        account={acc.status === "signedIn" ? accountLabel(acc.user) : null}
        points={f.points}
        level={f.level}
        streak={f.streak}
        since={firstActiveDay({ records: progress.records, feed })}
      />
      <BadgesSection badges={badges} />
      </div>
      <div className="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-5">
      <GoalsCard
        water={goalFor(progress.goals, "water")?.target ?? null}
        sleep={goalFor(progress.goals, "sleep")?.target ?? null}
        interests={social.interests}
      />
      <SettingsCard lang={lang} discreet={feed.settings.discreet} />
      {acc.status === "signedIn" && <NotificationPrefs />}
      <PrivacyCard acc={acc} />
      </div>
      <p className="pb-2 lg:col-span-12 text-center text-[0.6875rem] text-ink-soft">{t("Kayani Men's Social · test version")}</p>
    </div>
    </SyncPull>
  );
}
