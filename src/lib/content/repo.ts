"use client";

// Where Studio content is stored.
// - Supabase (when keys are set): real publishing — every user sees published items.
// - Demo (no keys): saved in this browser only, so the Studio can be tried before setup.

import { getSupabase, supabaseConfigured } from "../supabase/client";
import { itemToRow, rowToItem, type ContentRow } from "./rows";
import type { ContentItem, ContentStatus } from "./types";

export interface Version {
  id: number;
  savedAt: string;
  status: string;
  item: ContentItem;
}

export interface ContentRepo {
  mode: "supabase" | "demo";
  listPublished(): Promise<ContentItem[]>;
  listAll(): Promise<ContentItem[]>;
  save(item: ContentItem, status: ContentStatus): Promise<ContentItem>;
  setStatus(id: string, status: ContentStatus): Promise<void>;
  remove(id: string): Promise<void>;
  uploadImage(file: File, contentId: string): Promise<string>;
  /** Short videos for "Quick learning" (Supabase only). */
  uploadVideo(file: File, contentId: string): Promise<string>;
  /** Audio lessons and podcasts (Supabase only). */
  uploadAudio(file: File, contentId: string): Promise<string>;
  /** Earlier versions of an item, newest first (Supabase only). */
  listVersions(id: string): Promise<Version[]>;
  /** Called when content changes, so screens can refresh. Returns an unsubscribe function. */
  subscribe(cb: () => void): () => void;
}

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

function checkVideo(file: File) {
  if (!/^video\/(mp4|webm|quicktime)$/.test(file.type)) throw new Error("Use an MP4, WebM or MOV video.");
  if (file.size > MAX_VIDEO_BYTES) throw new Error("Video is too large. Keep it under 50 MB (about 2 minutes in 720p).");
}

/** Database refusals arrive as plain sentences already (see migration 0006); tidy the generic ones. */
function friendlyDb(msg: string) {
  if (/row-level security/i.test(msg)) return "Not allowed: your admin role can't make this change.";
  if (/content_items_status_check/.test(msg)) return NEEDS_0006;
  if (/content_items_kind_check/.test(msg)) return NEEDS_0006;
  return msg;
}

export const MAX_AUDIO_BYTES = 40 * 1024 * 1024;
function checkAudio(file: File) {
  if (!/^audio\/(mpeg|mp4|x-m4a|aac|ogg|wav|webm)$/.test(file.type)) throw new Error("Use an MP3, M4A, AAC, OGG or WAV audio file.");
  if (file.size > MAX_AUDIO_BYTES) throw new Error("Audio is too large. Keep it under 40 MB.");
}

function checkImage(file: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Use a JPG, PNG or WebP image.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image is too large. Keep it under 3 MB.");
}

/* ───────────── Supabase ───────────── */
const BASE_COLUMNS =
  "id,status,kind,topic,title,title_sw,summary,minutes,priority,tags,body,body_sw,key_points,question,quiz,tool,source,review,cover,cover_image_url,origin,in_man_feed,points,published_at,updated_at";
const V4_COLUMNS = `${BASE_COLUMNS},featured,video_url,summary_sw`;
const V6_COLUMNS = `${V4_COLUMNS},publish_at,review_note,ai_generated,audio_url`;
const V4_FIELDS = ["featured", "video_url", "summary_sw"] as const;
const V6_FIELDS = ["publish_at", "review_note", "ai_generated", "audio_url"] as const;
/** True when Supabase hasn't run a newer migration yet (a column the app asks for isn't there). */
const missingColumn = (msg: string) => /column|schema cache/i.test(msg) && /featured|video_url|summary_sw|publish_at|review_note|ai_generated|audio_url/.test(msg);
const NEEDS_0004 = "To pin Featured items, add videos or a Kiswahili summary, run supabase/migrations/0004_studio_places_and_account_fix.sql in Supabase first.";
const NEEDS_0006 = "Review, scheduling, audio and AI drafts need supabase/migrations/0006_admin_control_center.sql. Run it in Supabase first.";

function supabaseRepo(): ContentRepo {
  const sb = getSupabase()!;
  const rows = (data: unknown) =>
    ((data as Partial<ContentRow>[]) ?? []).map(rowToItem).filter((x): x is ContentItem => x !== null);
  // Works before and after migrations 0004 and 0006: steps down to older columns if new ones aren't there yet
  let level: 6 | 4 | 0 = 6;
  const columns = () => (level === 6 ? V6_COLUMNS : level === 4 ? V4_COLUMNS : BASE_COLUMNS);
  async function select(published: boolean) {
    const run = () => {
      const q = sb.from("content_items").select(columns());
      return published ? q.eq("status", "published") : q.order("updated_at", { ascending: false });
    };
    let { data, error } = await run();
    while (error && level > 0 && missingColumn(error.message)) {
      level = level === 6 ? 4 : 0;
      ({ data, error } = await run());
    }
    if (error) throw new Error(error.message);
    const list = rows(data);
    // Scheduled items: hidden until their time, even for an admin browsing the app
    return published ? list.filter((c) => !c.publishAt || new Date(c.publishAt) <= new Date()) : list;
  }

  return {
    mode: "supabase",
    listPublished: () => select(true),
    listAll: () => select(false),
    async save(item, status) {
      const row: Record<string, unknown> = { ...itemToRow(item, status) };
      if (level < 6) {
        if (status === "review" || item.publishAt || item.aiGenerated || item.audioUrl || item.reviewNote) throw new Error(NEEDS_0006);
        V6_FIELDS.forEach((f) => delete row[f]);
      }
      if (level < 4) {
        if (item.featured || item.videoUrl || item.summarySw) throw new Error(NEEDS_0004);
        V4_FIELDS.forEach((f) => delete row[f]);
      }
      const { data, error } = await sb.from("content_items").upsert(row).select(columns()).single();
      if (error) throw new Error(missingColumn(error.message) ? (level === 6 ? NEEDS_0006 : NEEDS_0004) : friendlyDb(error.message));
      notify();
      return rowToItem(data as Partial<ContentRow>)!;
    },
    async setStatus(id, status) {
      // .select() so a change the database refused (row-level security) is reported, not silently ignored
      const { data, error } = await sb.from("content_items").update({ status }).eq("id", id).select("id");
      if (error) throw new Error(friendlyDb(error.message));
      if (!data?.length) throw new Error("Not allowed: your admin role can't make this change (or the item no longer exists).");
      notify();
    },
    async remove(id) {
      const { data, error } = await sb.from("content_items").delete().eq("id", id).select("id");
      if (error) throw new Error(friendlyDb(error.message));
      if (!data?.length) throw new Error("Not allowed: only editors and owners can delete live content (or it no longer exists).");
      notify();
    },
    async uploadAudio(file, contentId) {
      checkAudio(file);
      const ext = file.type.split("/")[1].replace("mpeg", "mp3").replace("x-m4a", "m4a");
      const path = `${contentId}/${Date.now()}.${ext}`;
      const { error } = await sb.storage.from("content-audio").upload(path, file, { contentType: file.type });
      if (error) throw new Error(/bucket not found/i.test(error.message) ? NEEDS_0006 : error.message);
      return sb.storage.from("content-audio").getPublicUrl(path).data.publicUrl;
    },
    async listVersions(id) {
      const { data, error } = await sb.from("content_versions").select("id,snapshot,status,saved_at").eq("content_id", id).order("saved_at", { ascending: false }).limit(30);
      if (error) throw new Error(missingColumn(error.message) || /does not exist/.test(error.message) ? NEEDS_0006 : error.message);
      return ((data ?? []) as { id: number; snapshot: Partial<ContentRow>; status: string; saved_at: string }[])
        .map((v) => ({ id: v.id, savedAt: v.saved_at, status: v.status, item: rowToItem(v.snapshot) }))
        .filter((v): v is Version => v.item !== null);
    },
    async uploadImage(file, contentId) {
      checkImage(file);
      const ext = file.type.split("/")[1].replace("jpeg", "jpg");
      const path = `${contentId}/${Date.now()}.${ext}`;
      const { error } = await sb.storage.from("content-images").upload(path, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      return sb.storage.from("content-images").getPublicUrl(path).data.publicUrl;
    },
    async uploadVideo(file, contentId) {
      checkVideo(file);
      const ext = file.type === "video/quicktime" ? "mov" : file.type.split("/")[1];
      const path = `${contentId}/${Date.now()}.${ext}`;
      const { error } = await sb.storage.from("content-videos").upload(path, file, { contentType: file.type });
      if (error) throw new Error(/bucket not found/i.test(error.message) ? NEEDS_0004 : error.message);
      return sb.storage.from("content-videos").getPublicUrl(path).data.publicUrl;
    },
    subscribe,
  };
}

/* ───────────── Demo (this browser) ───────────── */
const DEMO_KEY = "ms_studio_demo_v1";

function readDemo(): ContentItem[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as ContentItem[]) : [];
  } catch {
    return [];
  }
}
function writeDemo(items: ContentItem[]) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(items));
  } catch {
    throw new Error("This browser's storage is full. Remove some images or connect Supabase.");
  }
  notify();
}

function demoRepo(): ContentRepo {
  return {
    mode: "demo",
    async listPublished() {
      return readDemo().filter((c) => c.status === "published");
    },
    async listAll() {
      return readDemo().sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    },
    async save(item, status) {
      const saved: ContentItem = { ...item, status, fixture: false, builtIn: false, updatedAt: new Date().toISOString() };
      writeDemo([saved, ...readDemo().filter((c) => c.id !== item.id)]);
      return saved;
    },
    async setStatus(id, status) {
      writeDemo(readDemo().map((c) => (c.id === id ? { ...c, status, updatedAt: new Date().toISOString() } : c)));
    },
    async remove(id) {
      writeDemo(readDemo().filter((c) => c.id !== id));
    },
    async uploadImage(file) {
      checkImage(file);
      if (file.size > 900 * 1024) throw new Error("In demo mode images must be under 900 KB. Connect Supabase for bigger images.");
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Couldn't read that image."));
        r.readAsDataURL(file);
      });
    },
    async uploadVideo(file) {
      checkVideo(file);
      throw new Error("Videos need Supabase (demo mode can't store them). You can paste a link to an .mp4 instead.");
    },
    async uploadAudio(file) {
      checkAudio(file);
      throw new Error("Audio needs Supabase (demo mode can't store it). You can paste a link to an .mp3 instead.");
    },
    async listVersions() {
      return [];
    },
    subscribe,
  };
}

let repo: ContentRepo | null = null;
export function getContentRepo(): ContentRepo {
  if (!repo) repo = supabaseConfigured ? supabaseRepo() : demoRepo();
  return repo;
}

// Other tabs in demo mode: refresh when the saved list changes
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === DEMO_KEY) notify();
  });
}
