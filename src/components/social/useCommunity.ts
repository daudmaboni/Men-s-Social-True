"use client";

// Community data for the screens, from one of two places:
// - "server": the shared Community in Supabase (migration 0006) — what every man sees, moderated by staff
// - "phone": this phone only, with sample posts (when Supabase isn't set up or not updated yet)
// The screens use the same functions either way.

import { useEffect } from "react";
import { activityScore, reactionCount, REACTIONS, type CommunityTopic, type Post, type ReactionKind, type Reply } from "@/lib/social/community";
import { SAMPLE_POSTS, SAMPLE_REPLIES } from "@/lib/social/fixtures";
import { socialStore, useSocial } from "@/lib/social/store";
import { communityServer, loadReplies, refreshCommunity, useCommunityServer } from "@/lib/social/communityServer";

let started = false;

export function useCommunity() {
  const s = useSocial();
  const server = useCommunityServer();

  useEffect(() => {
    if (!started) {
      started = true;
      void refreshCommunity();
    }
    const onShow = () => document.visibilityState === "visible" && void refreshCommunity();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, []);

  const mode: "server" | "phone" = server.status === "unavailable" ? "phone" : "server";

  // Phone-only data (his posts + samples)
  const localReplies: Reply[] = [...SAMPLE_REPLIES, ...s.replies].filter((r) => !s.reports[r.id]);
  const localPosts: Post[] = [...s.posts, ...SAMPLE_POSTS].filter((p) => !s.reports[p.id]);

  const posts = mode === "server" ? server.posts : localPosts;
  const myReactions = mode === "server" ? server.myReactions : s.reactions;
  const repliesFor = (postId: string): Reply[] =>
    mode === "server"
      ? (server.replies[postId] ?? [])
      : localReplies.filter((r) => r.postId === postId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const replyCount = (postId: string) => (mode === "server" ? (server.replyCounts[postId] ?? 0) : repliesFor(postId).length);
  const totalReactions = (id: string, base: Post["baseReactions"]) => REACTIONS.reduce((n, r) => n + reactionCount(base, myReactions[id], r.kind), 0);

  const withCounts = posts.map((p) => ({ post: p, replyCount: replyCount(p.id), reactionTotal: totalReactions(p.id, p.baseReactions) }));

  return {
    mode,
    ready: s.ready && server.status !== "loading",
    enabled: mode === "phone" || server.enabled,
    error: server.status === "error" ? server.error : undefined,
    nickname: s.nickname,
    myReactions,
    list(sort: "new" | "active", topic: string | "all") {
      return withCounts
        .filter((x) => topic === "all" || x.post.topic === topic)
        .sort(
          (a, b) =>
            Number(Boolean(b.post.pinned)) - Number(Boolean(a.post.pinned)) ||
            (sort === "new"
              ? b.post.createdAt.localeCompare(a.post.createdAt)
              : activityScore(b.replyCount, b.reactionTotal) - activityScore(a.replyCount, a.reactionTotal)),
        );
    },
    getPost: (id: string) => posts.find((p) => p.id === id),
    repliesFor,
    loadReplies: (postId: string) => (mode === "server" ? loadReplies(postId) : Promise.resolve()),
    isReported: (id: string) => (mode === "server" ? Boolean(server.reported[id]) : Boolean(s.reports[id])),

    async createPost(input: { topic: CommunityTopic; title: string; body: string; anonymous: boolean; name: string; wantsExpert: boolean }): Promise<string> {
      if (mode === "server") return communityServer.createPost(input);
      if (!input.anonymous) socialStore.setNickname(input.name);
      return socialStore.addPost(input).id;
    },
    async reply(postId: string, body: string, anonymous: boolean) {
      if (mode === "server") return communityServer.reply(postId, body, anonymous, s.nickname);
      socialStore.addReply(postId, body, anonymous);
    },
    async react(targetId: string, kind: ReactionKind) {
      if (mode === "server") return communityServer.react(targetId, kind);
      socialStore.react(targetId, kind);
    },
    async report(type: "post" | "reply", targetId: string, reason: string) {
      if (mode === "server") return communityServer.report(type, targetId, reason);
      socialStore.report(targetId, reason);
    },
    async undoReport(targetId: string) {
      if (mode === "server") return communityServer.undoReport(targetId);
      socialStore.undoReport(targetId);
    },
    async deletePost(postId: string) {
      if (mode === "server") return communityServer.remove("post", postId);
      socialStore.deletePost(postId);
    },
    async deleteReply(replyId: string, postId: string) {
      if (mode === "server") return communityServer.remove("reply", replyId, postId);
      socialStore.deleteReply(replyId);
    },
  };
}

export type CommunityData = ReturnType<typeof useCommunity>;
