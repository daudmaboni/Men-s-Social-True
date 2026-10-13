"use client";

// Where Studio content is stored.
// - Supabase (when keys are set): real publishing — every user sees published items.
// - Demo (no keys): saved in this browser only, so the Studio can be tried before setup.

import { getSupabase, supabaseConfigured } from "../supabase/client";
import { itemToRow, rowToItem, type ContentRow } from "./rows";
import type { ContentItem, ContentStatus } from "./types";

export interface ContentRepo {
  mode: "supabase" | "demo";
  listPublished(): Promise<ContentItem[]>;
  listAll(): Promise<ContentItem[]>;
  save(item: ContentItem, status: ContentStatus): Promise<ContentItem>;
  setStatus(id: string, status: ContentStatus): Promise<void>;
  remove(id: string): Promise<void>;
  uploadImage(file: File, contentId: string): Promise<string>;
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

function checkImage(file: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Use a JPG, PNG or WebP image.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image is too large. Keep it under 3 MB.");
}

/* ───────────── Supabase ───────────── */
const COLUMNS =
  "id,status,kind,topic,title,title_sw,summary,minutes,priority,tags,body,body_sw,key_points,question,quiz,tool,source,review,cover,cover_image_url,origin,in_man_feed,points,updated_at";

function supabaseRepo(): ContentRepo {
  const sb = getSupabase()!;
  const rows = (data: unknown) =>
    ((data as Partial<ContentRow>[]) ?? []).map(rowToItem).filter((x): x is ContentItem => x !== null);

  return {
    mode: "supabase",
    async listPublished() {
      const { data, error } = await sb.from("content_items").select(COLUMNS).eq("status", "published");
      if (error) throw new Error(error.message);
      return rows(data);
    },
    async listAll() {
      const { data, error } = await sb.from("content_items").select(COLUMNS).order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return rows(data);
    },
    async save(item, status) {
      const { data, error } = await sb.from("content_items").upsert(itemToRow(item, status)).select(COLUMNS).single();
      if (error) throw new Error(error.message);
      notify();
      return rowToItem(data as Partial<ContentRow>)!;
    },
    async setStatus(id, status) {
      const { error } = await sb.from("content_items").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
      notify();
    },
    async remove(id) {
      const { error } = await sb.from("content_items").delete().eq("id", id);
      if (error) throw new Error(error.message);
      notify();
    },
    async uploadImage(file, contentId) {
      checkImage(file);
      const ext = file.type.split("/")[1].replace("jpeg", "jpg");
      const path = `${contentId}/${Date.now()}.${ext}`;
      const { error } = await sb.storage.from("content-images").upload(path, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      return sb.storage.from("content-images").getPublicUrl(path).data.publicUrl;
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
