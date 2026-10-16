"use client";

// Where courses are stored (Step 48): Supabase table course_versions (migration 0009).
// Men read the published copy; staff save drafts and publish through database functions.
// Without Supabase (demo mode) courses live in this browser, so the screens can still be tried.

import { getSupabase } from "../supabase/client";
import { MAX_AUDIO_BYTES, MAX_VIDEO_BYTES } from "../content/repo";
import type { Course } from "./types";

export interface CourseRow {
  course_id: string;
  state: "draft" | "published" | "archived";
  data: Course;
  note: string | null;
  saved_at: string;
  published_at: string | null;
}

const NEEDS_0009 = "Courses need supabase/migrations/0009_courses.sql. Run it in Supabase first.";
const missing = (msg: string) => /course_versions|course_save_draft|course_publish|does not exist|schema cache/i.test(msg);
const friendly = (msg: string) => (missing(msg) ? NEEDS_0009 : /row-level security|Not allowed/i.test(msg) ? "Not allowed: your admin role can't make this change." : msg);

const DEMO_KEY = "ms_courses_demo_v1";
type Demo = Record<string, Partial<Record<CourseRow["state"], CourseRow>>>;
function readDemo(): Demo {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) ?? "{}") as Demo;
  } catch {
    return {};
  }
}
function writeDemo(d: Demo) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(d));
  } catch {
    throw new Error("This browser's storage is full.");
  }
}

/** Published courses, for the men's app. */
export async function listLiveCourses(): Promise<Course[]> {
  const sb = getSupabase();
  if (!sb) return Object.values(readDemo()).flatMap((r) => (r.published ? [r.published.data] : []));
  const { data, error } = await sb.from("course_versions").select("data").eq("state", "published");
  if (error) throw new Error(friendly(error.message));
  return ((data ?? []) as { data: Course }[]).map((r) => r.data).filter((c) => c && Array.isArray(c.modules));
}

/** Staff: every draft and published course (not archived), newest first. */
export async function listStudioCourses(): Promise<CourseRow[]> {
  const sb = getSupabase();
  if (!sb) return Object.values(readDemo()).flatMap((r) => [r.draft, r.published].filter((x): x is CourseRow => Boolean(x)));
  const { data, error } = await sb
    .from("course_versions")
    .select("course_id,state,data,note,saved_at,published_at")
    .in("state", ["draft", "published"])
    .order("saved_at", { ascending: false });
  if (error) throw new Error(friendly(error.message));
  return (data ?? []) as CourseRow[];
}

export async function saveCourseDraft(c: Course): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const d = readDemo();
    d[c.id] = { ...d[c.id], draft: { course_id: c.id, state: "draft", data: c, note: null, saved_at: new Date().toISOString(), published_at: null } };
    return writeDemo(d);
  }
  const { error } = await sb.rpc("course_save_draft", { p_course: c.id, p_data: c });
  if (error) throw new Error(friendly(error.message));
}

export async function publishCourse(id: string, note?: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const d = readDemo();
    const draft = d[id]?.draft;
    if (!draft) throw new Error("There are no unpublished changes.");
    d[id] = { published: { ...draft, state: "published", note: note ?? null, published_at: new Date().toISOString() } };
    return writeDemo(d);
  }
  const { error } = await sb.rpc("course_publish", { p_course: id, p_note: note ?? null });
  if (error) throw new Error(friendly(error.message));
}

export async function discardCourseDraft(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const d = readDemo();
    if (d[id]) delete d[id].draft;
    return writeDemo(d);
  }
  const { error } = await sb.rpc("course_discard_draft", { p_course: id });
  if (error) throw new Error(friendly(error.message));
}

export async function unpublishCourse(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const d = readDemo();
    if (d[id]) delete d[id].published;
    return writeDemo(d);
  }
  const { error } = await sb.rpc("course_unpublish", { p_course: id });
  if (error) throw new Error(friendly(error.message));
}

/** Audio types phones can play everywhere. (.opus isn't played by older iPhones: convert to M4A or MP3.) */
const AUDIO = /^audio\/(mpeg|mp4|x-m4a|aac|wav|webm|ogg)$/;
const VIDEO = /^video\/(mp4|webm|quicktime)$/;

/** Upload a lesson's audio or video. Returns its public address. */
export async function uploadLessonMedia(file: File, courseId: string, lessonId: string, kind: "audio" | "video"): Promise<string> {
  // Some computers give .m4a files no type: treat them as audio/mp4
  const type = file.type || (/\.m4a$/i.test(file.name) ? "audio/mp4" : /\.mp3$/i.test(file.name) ? "audio/mpeg" : /\.mp4$/i.test(file.name) ? "video/mp4" : "");
  if (kind === "audio") {
    if (/\.opus$/i.test(file.name) || type === "audio/opus") throw new Error("Opus files don't play on many iPhones. Use the converted M4A file instead.");
    if (!AUDIO.test(type)) throw new Error("Use an M4A, MP3, AAC or WAV audio file.");
    if (file.size > MAX_AUDIO_BYTES) throw new Error("Audio is too large. Keep it under 40 MB.");
  } else {
    if (!VIDEO.test(type)) throw new Error("Use an MP4, WebM or MOV video.");
    if (file.size > MAX_VIDEO_BYTES) throw new Error("Video is too large. Keep it under 50 MB.");
  }
  const sb = getSupabase();
  if (!sb) throw new Error("Uploading needs Supabase (demo mode can't store files).");
  const bucket = kind === "audio" ? "content-audio" : "content-videos";
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `courses/${courseId}/${lessonId}-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from(bucket).upload(path, file, { contentType: type });
  if (error) throw new Error(error.message);
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Length of an audio/video file in seconds, read in the browser before uploading (null if unknown). */
export function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(file.type.startsWith("video") ? "video" : "audio");
    const done = (v: number | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    el.preload = "metadata";
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) && el.duration > 0 ? Math.round(el.duration) : null);
    el.onerror = () => done(null);
    setTimeout(() => done(null), 15_000);
    el.src = url;
  });
}
