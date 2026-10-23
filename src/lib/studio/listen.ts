"use client";

// The Card maker can listen and watch (Step 85).
//  - listen(): turns a voice note or a reel's sound into text, right here in the Studio browser, with
//    Whisper (OpenAI's free speech-recognition model, run by Transformers.js). Free: no API, no account,
//    and the recording never leaves the laptop. The first time it downloads the model (about 240 MB,
//    then kept by the browser) and the speech engine (about 21 MB). It handles Kiswahili and English;
//    the text isn't perfect, so it goes into the notes box for staff to check before making the card.
//  - stills(): takes a few still pictures from a video, so the AI can read text written on screen.
// Studio only: men's screens never load any of this.

export type ListenProgress =
  | { stage: "download"; percent: number }
  | { stage: "listening"; seconds: number }
  | { stage: "done" };

/** The Whisper model used. "small" is the smallest that understands Kiswahili reasonably well. */
export const WHISPER_MODEL = "onnx-community/whisper-small";
/** Longest recording it will listen to (longer ones: the first 15 minutes). */
export const MAX_SECONDS = 15 * 60;
const RATE = 16_000;

/** The recording as one 16 kHz mono track (what Whisper wants). Works for voice notes and videos. */
export async function decodeMono16k(file: Blob): Promise<Float32Array> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error("This browser can't open the sound in this file. Try saving it as MP3 or M4A, or use Chrome.");
  } finally {
    void ctx.close();
  }
  const seconds = Math.min(decoded.duration, MAX_SECONDS);
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(seconds * RATE)), RATE);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start(0, 0, seconds);
  const out = await off.startRendering();
  return out.getChannelData(0);
}

type Asr = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string } | { text: string }[]>;
let asr: Promise<Asr> | null = null;

/** Load Whisper once per page (the browser keeps the downloaded files for next time). */
function loadAsr(onDownload: (percent: number) => void): Promise<Asr> {
  asr ??= (async () => {
    const tf = await import("@huggingface/transformers");
    tf.env.allowLocalModels = false;
    const files = new Map<string, { loaded: number; total: number }>();
    const gpu = typeof navigator !== "undefined" && "gpu" in navigator;
    const pipe = await tf.pipeline("automatic-speech-recognition", WHISPER_MODEL, {
      device: gpu ? "webgpu" : "wasm",
      dtype: gpu ? { encoder_model: "fp32", decoder_model_merged: "q4" } : "q8",
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status === "progress" && p.file && p.total) {
          files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
          let l = 0;
          let t = 0;
          files.forEach((f) => ((l += f.loaded), (t += f.total)));
          onDownload(t ? Math.round((l / t) * 100) : 0);
        }
      },
    });
    return pipe as unknown as Asr;
  })().catch((e) => {
    asr = null; // let him try again
    throw e;
  });
  return asr;
}

/** Turn a voice note or a video's sound into text. `language`: "sw", "en", or null to let Whisper decide. */
export async function listen(file: Blob, language: "sw" | "en" | null, onProgress: (p: ListenProgress) => void): Promise<string> {
  const audio = await decodeMono16k(file);
  if (audio.length < RATE / 2) throw new Error("There's almost no sound in this file.");
  const run = await loadAsr((percent) => onProgress({ stage: "download", percent }));
  onProgress({ stage: "listening", seconds: Math.round(audio.length / RATE) });
  const out = await run(audio, {
    chunk_length_s: 30,
    stride_length_s: 5,
    task: "transcribe",
    ...(language ? { language: language === "sw" ? "swahili" : "english" } : {}),
  });
  onProgress({ stage: "done" });
  const text = (Array.isArray(out) ? out.map((o) => o.text).join(" ") : out.text).replace(/\s+/g, " ").trim();
  if (!text) throw new Error("Couldn't hear any words. Write what it says in the notes instead.");
  return text;
}

/** When to take `n` still pictures from a video `duration` seconds long: evenly spread, never at the very start or end. */
export function stillTimes(duration: number, n = 6): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [0];
  const count = Math.max(1, Math.min(n, Math.ceil(duration)));
  return Array.from({ length: count }, (_, i) => Math.round(((i + 0.5) / count) * duration * 100) / 100);
}

/** A few still pictures (JPEG, base64 without the "data:" part) from a video, for the AI to read on-screen text. */
export async function stills(file: Blob, n = 6, width = 720): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((ok, fail) => {
      video.onloadedmetadata = () => ok();
      video.onerror = () => fail(new Error("This browser can't open this video."));
    });
    const scale = Math.min(1, width / (video.videoWidth || width));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((video.videoWidth || width) * scale);
    canvas.height = Math.round((video.videoHeight || width) * scale);
    const g = canvas.getContext("2d");
    if (!g) return [];
    const out: string[] = [];
    for (const t of stillTimes(video.duration, n)) {
      await new Promise<void>((ok) => {
        video.onseeked = () => ok();
        video.currentTime = t;
      });
      g.drawImage(video, 0, 0, canvas.width, canvas.height);
      out.push(canvas.toDataURL("image/jpeg", 0.7).split(",")[1] ?? "");
    }
    return out.filter(Boolean);
  } finally {
    URL.revokeObjectURL(url);
  }
}
