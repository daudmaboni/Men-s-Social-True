"use client";

import { activityScore, reactionCount, REACTIONS, type Post, type Reply } from "@/lib/social/community";
import { SAMPLE_POSTS, SAMPLE_REPLIES } from "@/lib/social/fixtures";
import { useSocial } from "@/lib/social/store";

/** His posts + sample posts, minus anything he reported, with reply and reaction counts. */
export function useCommunity() {
  const s = useSocial();

  const replies: Reply[] = [...SAMPLE_REPLIES, ...s.replies].filter((r) => !s.reports[r.id]);
  const posts: Post[] = [...s.posts, ...SAMPLE_POSTS].filter((p) => !s.reports[p.id]);

  const repliesFor = (postId: string) =>
    replies.filter((r) => r.postId === postId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const totalReactions = (id: string, base: Post["baseReactions"]) =>
    REACTIONS.reduce((n, r) => n + reactionCount(base, s.reactions[id], r.kind), 0);

  const withCounts = posts.map((p) => ({
    post: p,
    replyCount: repliesFor(p.id).length,
    reactionTotal: totalReactions(p.id, p.baseReactions),
  }));

  return {
    ready: s.ready,
    nickname: s.nickname,
    myReactions: s.reactions,
    reportedCount: Object.keys(s.reports).length,
    list(sort: "new" | "active", topic: string | "all") {
      return withCounts
        .filter((x) => topic === "all" || x.post.topic === topic)
        .sort((a, b) =>
          sort === "new"
            ? b.post.createdAt.localeCompare(a.post.createdAt)
            : activityScore(b.replyCount, b.reactionTotal) - activityScore(a.replyCount, a.reactionTotal),
        );
    },
    getPost: (id: string) => posts.find((p) => p.id === id),
    repliesFor,
    isReported: (id: string) => Boolean(s.reports[id]),
  };
}

export type CommunityData = ReturnType<typeof useCommunity>;
