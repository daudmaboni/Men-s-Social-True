"use client";

// "Me": who he is in the app, what he's earned, his goals, settings and privacy controls.
// Everything here comes from his real activity on this phone.

import ProfileHero from "@/components/me/ProfileHero";
import BadgesSection from "@/components/me/BadgesSection";
import { GoalsCard, PrivacyCard, SettingsCard } from "@/components/me/SettingsSections";
import { useHomeFeed } from "@/components/feed/useHomeFeed";
import { useFeed } from "@/lib/feed/store";
import { computeBadges, firstActiveDay } from "@/lib/me/badges";
import { useLang } from "@/lib/me/lang";
import { goalFor, useProgress } from "@/lib/progress/store";
import { useSocial } from "@/lib/social/store";

export default function MePage() {
  const f = useHomeFeed();
  const feed = useFeed();
  const progress = useProgress();
  const social = useSocial();
  const lang = useLang();

  if (!f.ready || !social.ready) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <div className="h-52 animate-pulse rounded-[28px] bg-forest-deep/15" />
        <div className="h-64 animate-pulse rounded-3xl bg-surface ring-1 ring-line" />
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

  return (
    <div className="stagger space-y-4">
      <h1 className="text-2xl font-bold">Me</h1>
      <ProfileHero
        nickname={social.nickname}
        points={f.points}
        level={f.level}
        streak={f.streak}
        since={firstActiveDay({ records: progress.records, feed })}
      />
      <BadgesSection badges={badges} />
      <GoalsCard
        water={goalFor(progress.goals, "water")?.target ?? null}
        sleep={goalFor(progress.goals, "sleep")?.target ?? null}
        interests={social.interests}
      />
      <SettingsCard lang={lang} discreet={feed.settings.discreet} />
      <PrivacyCard />
      <p className="pb-2 text-center text-[11px] text-ink-soft">Kayani Men&apos;s Social · test version</p>
    </div>
  );
}
