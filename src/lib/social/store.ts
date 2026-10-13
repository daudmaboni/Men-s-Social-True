"use client";

// Saves Social data: bookmarks, chosen topics, his posts and replies, reactions and reports.
// NOW: on this phone only (localStorage). LATER: the server, so other men can see his posts.

import { useSyncExternalStore } from "react";
import type { TopicId } from "../content/types";
import { toggleReaction, type CommunityTopic, type Post, type ReactionKind, type Reply } from "./community";

export interface SocialDB {
  bookmarks: Record<string, string>; // contentId → saved at
  interests: TopicId[];
  nickname: string;
  posts: Post[]; // his own posts
  replies: Reply[]; // his own replies
  reactions: Record<string, ReactionKind[]>; // postId/replyId → his reactions
  reports: Record<string, { reason: string; at: string }>; // reported items (hidden for him, queued for moderators)
}
export type SocialState = SocialDB & { ready: boolean };

const KEY = "ms_social_v1";
const EMPTY: SocialDB = { bookmarks: {}, interests: [], nickname: "", posts: [], replies: [], reactions: {}, reports: {} };
const SERVER_STATE: SocialState = { ...EMPTY, ready: false };
let cache: SocialState | null = null;
const listeners = new Set<() => void>();
/** Told only about HIS changes (not about data arriving from his account), so they can be saved to it. */
const changeListeners = new Set<() => void>();

const obj = <T,>(v: unknown, fallback: T): T => (v && typeof v === "object" ? (v as T) : fallback);

function load(): SocialState {
  if (cache) return cache;
  let db = EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SocialDB>;
      db = {
        bookmarks: obj(p.bookmarks, {}),
        interests: Array.isArray(p.interests) ? p.interests : [],
        nickname: typeof p.nickname === "string" ? p.nickname : "",
        posts: Array.isArray(p.posts) ? p.posts : [],
        replies: Array.isArray(p.replies) ? p.replies : [],
        reactions: obj(p.reactions, {}),
        reports: obj(p.reports, {}),
      };
    }
  } catch {
    // Storage blocked or corrupted — start empty rather than crash
  }
  cache = { ...db, ready: true };
  return cache;
}

function save(next: SocialDB) {
  cache = { ...next, ready: true };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // keep working in memory
  }
  listeners.forEach((l) => l());
  changeListeners.forEach((l) => l());
}

const id = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export function useSocial(): SocialState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    load,
    () => SERVER_STATE,
  );
}

export const socialStore = {
  toggleBookmark(contentId: string): boolean {
    const db = load();
    const next = { ...db.bookmarks };
    const saved = !next[contentId];
    if (saved) next[contentId] = new Date().toISOString();
    else delete next[contentId];
    save({ ...db, bookmarks: next });
    return saved;
  },

  setInterests(interests: TopicId[]) {
    save({ ...load(), interests });
  },

  setNickname(nickname: string) {
    save({ ...load(), nickname: nickname.trim().slice(0, 24) });
  },

  addPost(input: { topic: CommunityTopic; title: string; body: string; anonymous: boolean; wantsExpert: boolean }): Post {
    const db = load();
    const post: Post = {
      id: id(),
      topic: input.topic,
      title: input.title.trim(),
      body: input.body.trim(),
      author: input.anonymous || !db.nickname ? { name: "Anonymous member", anonymous: true } : { name: db.nickname, anonymous: false },
      createdAt: new Date().toISOString(),
      wantsExpert: input.wantsExpert,
      mine: true,
    };
    save({ ...db, posts: [post, ...db.posts] });
    return post;
  },

  deletePost(postId: string) {
    const db = load();
    save({ ...db, posts: db.posts.filter((p) => p.id !== postId), replies: db.replies.filter((r) => r.postId !== postId) });
  },

  addReply(postId: string, body: string, anonymous: boolean): Reply {
    const db = load();
    const reply: Reply = {
      id: id(),
      postId,
      body: body.trim(),
      author: anonymous || !db.nickname ? { name: "Anonymous member", anonymous: true } : { name: db.nickname, anonymous: false },
      createdAt: new Date().toISOString(),
      mine: true,
    };
    save({ ...db, replies: [...db.replies, reply] });
    return reply;
  },

  deleteReply(replyId: string) {
    const db = load();
    save({ ...db, replies: db.replies.filter((r) => r.id !== replyId) });
  },

  react(targetId: string, kind: ReactionKind) {
    const db = load();
    save({ ...db, reactions: { ...db.reactions, [targetId]: toggleReaction(db.reactions[targetId], kind) } });
  },

  report(targetId: string, reason: string) {
    const db = load();
    save({ ...db, reports: { ...db.reports, [targetId]: { reason, at: new Date().toISOString() } } });
  },

  undoReport(targetId: string) {
    const db = load();
    const reports = { ...db.reports };
    delete reports[targetId];
    save({ ...db, reports });
  },
};

/** Used by account sync: read, replace or clear this phone's copy. */
export const socialSync = {
  get(): SocialDB {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ready, ...db } = load();
    return db;
  },
  /** Data from his account: saved on the phone and shown, but not sent back again. */
  replace(db: SocialDB) {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {}
    cache = null;
    load();
    listeners.forEach((l) => l());
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    cache = null;
    listeners.forEach((l) => l());
  },
  onChange(cb: () => void) {
    changeListeners.add(cb);
    return () => {
      changeListeners.delete(cb);
    };
  },
};
