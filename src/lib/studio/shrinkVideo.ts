// Shrinking big videos in the Studio before upload (Step 75).
// Supabase's free plan takes files up to 50 MB. A phone video is often much bigger because it's saved
// at full quality. The browser plays the video once (silently), draws it at 720p, and records it again
// at a lower bitrate: a 1-minute video takes about 1 minute. Works in Chrome/Edge on a computer and
// Chrome on Android. Nothing leaves the computer until the smaller file is ready.

import { MAX_VIDEO_BYTES } from "../content/repo";

/** Aim a little under the limit: the recorder's bitrate is only approximate. */
export const TARGET_BYTES = 44 * 1024 * 1024;
const AUDIO_BPS = 96_000;
/** Below this, the picture gets too blurry: the video is too long to fit. */
export const MIN_VIDEO_BPS = 350_000;

export interface ShrinkPlan {
  width: number;
  height: number;
  videoBps: number;
  audioBps: number;
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** The size and bitrate to record at, or null if the video is too long to fit in 50 MB. */
export function planShrink(duration: number, w: number, h: number, factor = 1, target = TARGET_BYTES): ShrinkPlan | null {
  if (!(duration > 0) || !(w > 0) || !(h > 0)) return null;
  const short = Math.min(w, h);
  const scale = short > 720 ? 720 / short : 1;
  const width = even(w * scale);
  const height = even(h * scale);
  // 720p looks sharp at 2.5 Mbps; smaller videos need less
  const cap = Math.min(width, height) >= 700 ? 2_500_000 : 1_600_000;
  const budget = ((target * 8) / duration) * 0.9 - AUDIO_BPS;
  const videoBps = Math.floor(Math.min(cap, budget) * factor);
  if (videoBps < MIN_VIDEO_BPS) return null;
  return { width, height, videoBps, audioBps: AUDIO_BPS };
}

/** The longest video (in seconds) that still fits. */
export const maxSeconds = (target = TARGET_BYTES) => Math.floor(((target * 8) * 0.9) / (MIN_VIDEO_BPS + AUDIO_BPS));

/** The best recording format this browser has: MP4 (plays everywhere) first, then WebM. */
export function pickRecorderType(isSupported: (t: string) => boolean): string | null {
  for (const t of [
    "video/mp4;codecs=avc1.42E01F,mp4a.40.2",
    "video/mp4;codecs=avc1.4D401F,mp4a.40.2",
    "video/mp4;codecs=avc1,mp4a",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ])
    if (isSupported(t)) return t;
  return null;
}

/** Can this browser shrink videos? */
export function canShrink(): boolean {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return false;
  const c = document.createElement("canvas") as HTMLCanvasElement & { captureStream?: unknown };
  return typeof c.captureStream === "function" && pickRecorderType((t) => MediaRecorder.isTypeSupported(t)) !== null;
}

export class ShrinkError extends Error {}

/**
 * Make a video small enough to upload. Calls onProgress with 0–1.
 * Throws ShrinkError with a plain message when it can't (format, too long, cancelled).
 */
export async function shrinkVideo(file: File, opts: { onProgress?: (f: number, pass: number) => void; signal?: AbortSignal } = {}): Promise<File> {
  const type = pickRecorderType((t) => MediaRecorder.isTypeSupported(t));
  if (!type) throw new ShrinkError("This browser can't make videos smaller. Use Chrome, or shrink it in CapCut (Export → 720p).");
  for (const factor of [1, 0.6]) {
    const out = await onePass(file, type, factor, factor === 1 ? 1 : 2, opts);
    if (out.size <= MAX_VIDEO_BYTES) return out;
  }
  throw new ShrinkError("Even made smaller, this video is over 50 MB. Cut it shorter (under 5 minutes), or paste a YouTube link instead.");
}

async function onePass(file: File, type: string, factor: number, pass: number, opts: { onProgress?: (f: number, pass: number) => void; signal?: AbortSignal }): Promise<File> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.playsInline = true;
  video.preload = "auto";
  let ctx: AudioContext | null = null;
  const cleanup = () => {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
    void ctx?.close().catch(() => {});
  };
  try {
    await new Promise<void>((ok, fail) => {
      video.onloadedmetadata = () => ok();
      video.onerror = () => fail(new ShrinkError("This browser can't read this video (often iPhone HEVC videos on Windows). Shrink it in CapCut (Export → 720p), then upload."));
    });
    const duration = video.duration;
    if (!Number.isFinite(duration)) throw new ShrinkError("Couldn't read how long this video is. Shrink it in CapCut (Export → 720p), then upload.");
    const plan = planShrink(duration, video.videoWidth, video.videoHeight, factor);
    if (!plan) throw new ShrinkError(`This video is too long to fit in 50 MB (${Math.round(duration / 60)} min). Keep it under ${Math.floor(maxSeconds() / 60)} minutes, or paste a YouTube link instead.`);

    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    const g = canvas.getContext("2d");
    if (!g) throw new ShrinkError("This browser can't make videos smaller. Use Chrome.");
    const tracks: MediaStreamTrack[] = [...(canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }).captureStream(30).getVideoTracks()];
    // The sound goes straight into the recording, not out of the speakers
    try {
      ctx = new AudioContext();
      const src = ctx.createMediaElementSource(video);
      const dest = ctx.createMediaStreamDestination();
      src.connect(dest);
      tracks.push(...dest.stream.getAudioTracks());
      await ctx.resume();
    } catch {
      video.muted = true; // no sound in the recording rather than no video
    }

    const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: type, videoBitsPerSecond: plan.videoBps, audioBitsPerSecond: plan.audioBps });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise<void>((ok) => (rec.onstop = () => ok()));

    // Draw every frame as it plays
    let running = true;
    const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
    const draw = () => {
      if (!running) return;
      g.drawImage(video, 0, 0, plan.width, plan.height);
      opts.onProgress?.(Math.min(1, video.currentTime / duration), pass);
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(draw);
      else requestAnimationFrame(draw);
    };

    const ended = new Promise<void>((ok, fail) => {
      video.onended = () => ok();
      video.onerror = () => fail(new ShrinkError("The video stopped playing while it was being made smaller. Try again."));
      opts.signal?.addEventListener("abort", () => fail(new ShrinkError("Stopped.")));
    });

    video.currentTime = 0;
    rec.start(1000);
    try {
      await video.play();
    } catch {
      rec.stop();
      throw new ShrinkError("The browser blocked playing the video. Tap the upload button again.");
    }
    draw();
    try {
      await ended;
    } finally {
      running = false;
      if (rec.state !== "inactive") rec.stop();
      await stopped;
    }
    const base = type.split(";")[0];
    const name = file.name.replace(/\.[^.]+$/, "") + (base === "video/mp4" ? ".mp4" : ".webm");
    return new File(chunks, name, { type: base });
  } finally {
    cleanup();
  }
}
