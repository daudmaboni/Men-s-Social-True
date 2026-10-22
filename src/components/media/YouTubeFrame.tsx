"use client";

// A YouTube video playing inside the app (Step 74). YouTube's embedded player, steered by messages
// (no YouTube script on our pages): the app says play / pause / sound on / sound off, and YouTube
// reports the time so reels can show progress and count how much he watched.

import { useEffect, useRef, useState } from "react";
import { embedUrl, notEmbeddable, youtubeThumb } from "@/lib/content/youtube";
import { useT } from "@/lib/i18n";

const YT_ORIGINS = ["https://www.youtube-nocookie.com", "https://www.youtube.com"];

export function YouTubeFrame({
  id,
  playing,
  muted = true,
  controls = false,
  loop = false,
  title,
  className = "",
  onProgress,
  onEnded,
  onBlocked,
}: {
  id: string;
  /** Play when true, pause when false. Leave undefined to let him use YouTube's own buttons. */
  playing?: boolean;
  muted?: boolean;
  controls?: boolean;
  loop?: boolean;
  title: string;
  className?: string;
  onProgress?: (seconds: number, duration: number) => void;
  onEnded?: () => void;
  /** The owner doesn't allow the video in other apps (or it was removed). */
  onBlocked?: () => void;
}) {
  const t = useT();
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const cb = useRef({ onProgress, onEnded, onBlocked });
  cb.current = { onProgress, onEnded, onBlocked };

  const send = (func: string, args: unknown[] = []) => {
    try {
      frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
    } catch {}
  };

  // Messages from the player: ready, time, ended, errors
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!YT_ORIGINS.includes(e.origin) || e.source !== frame.current?.contentWindow) return;
      let m: { event?: string; info?: unknown };
      try {
        m = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (m.event === "onReady") setReady(true);
      else if (m.event === "infoDelivery" && m.info && typeof m.info === "object") {
        const info = m.info as { currentTime?: number; duration?: number; playerState?: number };
        if (typeof info.currentTime === "number" && info.duration) cb.current.onProgress?.(info.currentTime, info.duration);
        if (info.playerState === 0) cb.current.onEnded?.();
      } else if (m.event === "onError" && typeof m.info === "number" && notEmbeddable(m.info)) {
        setBlocked(true);
        cb.current.onBlocked?.();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Start listening once the frame has loaded (YouTube then sends onReady and the time)
  const onLoad = () => {
    try {
      frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
    } catch {}
  };

  useEffect(() => {
    if (!ready || playing === undefined) return;
    send(playing ? "playVideo" : "pauseVideo");
  }, [ready, playing]);
  useEffect(() => {
    if (!ready) return;
    send(muted ? "mute" : "unMute");
    if (!muted) send("setVolume", [100]);
  }, [ready, muted]);

  const [origin, setOrigin] = useState<string | undefined>(undefined);
  useEffect(() => setOrigin(window.location.origin), []);
  // Pass "absolute inset-0" to fill a box; otherwise it sizes itself (give it an aspect ratio)
  const box = /\b(absolute|fixed)\b/.test(className) ? className : `relative ${className}`;
  if (!origin) return <div className={`bg-black ${box}`} />;

  return (
    <div className={`overflow-hidden bg-black ${box}`}>
      <iframe
        ref={frame}
        src={embedUrl(id, { controls, loop, origin })}
        title={title}
        onLoad={onLoad}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className={`absolute inset-0 h-full w-full border-0 ${controls ? "" : "pointer-events-none"}`}
      />
      {blocked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 p-6 text-center text-sm text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={youtubeThumb(id)} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" />
          {t("This video can't play here.")}
        </div>
      )}
    </div>
  );
}
