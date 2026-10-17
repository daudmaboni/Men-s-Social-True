"use client";

// Shared Community on the server (migration 0006): every man sees the same posts and replies.
// Men never read the tables directly; database functions return only safe fields (never who wrote an
// anonymous post), apply the safety rules again, and hide what moderators removed or he reported.

import { useSyncExternalStore } from "react";
import { getSupabase } from "../supabase/client";
import { storedUser } from "../account/useAccount";
import type { CommunityTopic, Post, ReactionKind, Reply } from "./community";

type Row = {
  id: string;
  topic?: CommunityTopic;
  title?: string;
  body: string;
  anonymous: boolean;
  display_name: string | null;
  wants_expert?: boolean;
  pinned?: boolean;
  featured?: boolean;
  status: "visible" | "hidden" | "removed";
  created_at: string;
  mine: boolean;
  reply_count?: number;
  reactions: Partial<Record<ReactionKind, number>>;
  my_reactions: ReactionKind[];
};

export type ServerState = {
  /** "loading" until the first answer; "unavailable" when the database hasn't got Community yet (then the phone-only version is used) */
  status: "loading" | "ready" | "unavailable" | "error";
  enabled: boolean;
  posts: Post[];
  replyCounts: Record<string, number>;
  replies: Record<string, Reply[]>;
  myReactions: Record<string, ReactionKind[]>;
  reported: Record<string, true>;
  error?: string;
};

const LOADING: ServerState = { status: "loading", enabled: true, posts: [], replyCounts: {}, replies: {}, myReactions: {}, reported: {} };
let state: ServerState = LOADING;
const listeners = new Set<() => void>();
const set = (patch: Partial<ServerState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

/* Step 58: the Community list is remembered on the phone, so it shows straight away when he
 * opens Community (and offline). The server's answer replaces it a moment later.
 * The copy belongs to one account: it is only used while the same man is signed in on this
 * phone, and it is removed when he signs out (see account.signOut). */
export const COMMUNITY_CACHE_KEY = "ms_community_v1";
type Cached = { uid: string; at: string; enabled: boolean; posts: Post[]; replyCounts: Record<string, number>; myReactions: Record<string, ReactionKind[]> };

function readCache(): Cached | null {
  try {
    const uid = storedUser()?.id;
    const raw = localStorage.getItem(COMMUNITY_CACHE_KEY);
    if (!uid || !raw) return null;
    const c = JSON.parse(raw) as Cached;
    return c.uid === uid && Array.isArray(c.posts) ? c : null;
  } catch {
    return null;
  }
}
function writeCache() {
  try {
    const uid = storedUser()?.id;
    if (!uid) return;
    const c: Cached = { uid, at: new Date().toISOString(), enabled: state.enabled, posts: state.posts, replyCounts: state.replyCounts, myReactions: state.myReactions };
    localStorage.setItem(COMMUNITY_CACHE_KEY, JSON.stringify(c));
  } catch {}
}

let fromCacheTried = false;
/** On the phone: the first read picks up the remembered list (the server render always starts "loading"). */
function snapshot(): ServerState {
  if (!fromCacheTried && state === LOADING) {
    fromCacheTried = true;
    const c = readCache();
    if (c) state = { ...state, status: "ready", enabled: c.enabled !== false, posts: c.posts, replyCounts: c.replyCounts ?? {}, myReactions: c.myReactions ?? {} };
  }
  return state;
}

const author = (r: Row) => (r.anonymous || !r.display_name ? { name: "Anonymous member", anonymous: true } : { name: r.display_name, anonymous: false });
/** The server's counts include his own reactions; the app adds his on top, so take them out of the base */
const base = (r: Row) => {
  const b = { ...r.reactions };
  for (const k of r.my_reactions ?? []) b[k] = Math.max(0, (b[k] ?? 1) - 1);
  return b;
};

function toPost(r: Row): Post {
  return { id: r.id, topic: r.topic!, title: r.title!, body: r.body, author: author(r), createdAt: r.created_at, wantsExpert: r.wants_expert, mine: r.mine, baseReactions: base(r), pinned: r.pinned, featured: r.featured, status: r.status };
}
function toReply(postId: string, r: Row): Reply {
  return { id: r.id, postId, body: r.body, author: author(r), createdAt: r.created_at, mine: r.mine, baseReactions: base(r), status: r.status };
}

const missing = (msg: string) => /could not find the function|schema cache|does not exist/i.test(msg);

function rpcErr(e: { message: string } | null) {
  if (!e) return null;
  return new Error(e.message.replace(/^.*?ERROR:\s*/, ""));
}

let loading: Promise<void> | null = null;
export function refreshCommunity(): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    set({ status: "unavailable" });
    return Promise.resolve();
  }
  loading ??= (async () => {
    const [list, flag] = await Promise.all([
      sb.rpc("community_list", { p_topic: "all", p_sort: "new", p_limit: 100 }),
      sb.from("app_settings").select("value").eq("key", "community_enabled").maybeSingle(),
    ]);
    if (list.error) {
      if (missing(list.error.message)) set({ status: "unavailable" });
      // Offline or a server problem: keep showing the remembered list if there is one
      else if (state.status === "ready" && state.posts.length) set({ error: list.error.message });
      else set({ status: "error", error: list.error.message });
      return;
    }
    const rows = (list.data ?? []) as Row[];
    const myReactions: Record<string, ReactionKind[]> = { ...state.myReactions };
    const replyCounts: Record<string, number> = {};
    for (const r of rows) {
      myReactions[r.id] = r.my_reactions ?? [];
      replyCounts[r.id] = r.reply_count ?? 0;
    }
    set({ status: "ready", enabled: flag.data?.value !== false, posts: rows.map(toPost), replyCounts, myReactions, error: undefined });
    writeCache();
  })().finally(() => {
    loading = null;
  });
  return loading;
}

export async function loadReplies(postId: string) {
  const sb = getSupabase();
  if (!sb) return;
  const { data, error } = await sb.rpc("community_replies_for", { p_post: postId });
  if (error) return;
  const rows = (data ?? []) as Row[];
  const myReactions = { ...state.myReactions };
  for (const r of rows) myReactions[r.id] = r.my_reactions ?? [];
  set({ replies: { ...state.replies, [postId]: rows.map((r) => toReply(postId, r)) }, replyCounts: { ...state.replyCounts, [postId]: rows.filter((r) => r.status === "visible").length }, myReactions });
}

export const communityServer = {
  async createPost(input: { topic: CommunityTopic; title: string; body: string; anonymous: boolean; name: string; wantsExpert: boolean }): Promise<string> {
    const { data, error } = await getSupabase()!.rpc("community_create_post", {
      p_topic: input.topic,
      p_title: input.title.trim(),
      p_body: input.body.trim(),
      p_anonymous: input.anonymous,
      p_name: input.anonymous ? null : input.name.trim(),
      p_wants_expert: input.wantsExpert,
    });
    if (error) throw rpcErr(error);
    await refreshCommunity();
    return data as string;
  },
  async reply(postId: string, body: string, anonymous: boolean, name: string) {
    const { error } = await getSupabase()!.rpc("community_create_reply", { p_post: postId, p_body: body.trim(), p_anonymous: anonymous, p_name: anonymous ? null : name });
    if (error) throw rpcErr(error);
    await loadReplies(postId);
  },
  async react(targetId: string, kind: ReactionKind) {
    // Shows straight away; the server confirms
    const mine = state.myReactions[targetId] ?? [];
    const on = !mine.includes(kind);
    set({ myReactions: { ...state.myReactions, [targetId]: on ? [...mine, kind] : mine.filter((k) => k !== kind) } });
    const { error } = await getSupabase()!.rpc("community_react", { p_target: targetId, p_kind: kind });
    if (error) set({ myReactions: { ...state.myReactions, [targetId]: mine } });
  },
  async report(type: "post" | "reply", targetId: string, reason: string) {
    const { error } = await getSupabase()!.rpc("community_report", { p_type: type, p_target: targetId, p_reason: reason });
    if (error) throw rpcErr(error);
    set({ reported: { ...state.reported, [targetId]: true } });
    await refreshCommunity();
    const postId = Object.keys(state.replies).find((p) => state.replies[p].some((r) => r.id === targetId));
    if (postId) await loadReplies(postId);
  },
  async undoReport(targetId: string) {
    const { error } = await getSupabase()!.rpc("community_undo_report", { p_target: targetId });
    if (error) throw rpcErr(error);
    const r = { ...state.reported };
    delete r[targetId];
    set({ reported: r });
    await refreshCommunity();
  },
  async remove(type: "post" | "reply", targetId: string, postId?: string) {
    const { error } = await getSupabase()!.rpc("community_delete_mine", { p_type: type, p_target: targetId });
    if (error) throw rpcErr(error);
    if (type === "post") await refreshCommunity();
    else if (postId) await loadReplies(postId);
  },
};

export function useCommunityServer(): ServerState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    () => LOADING,
  );
}
