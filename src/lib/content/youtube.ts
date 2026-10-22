// YouTube videos inside the app (Step 74). Staff paste a YouTube link in the Studio; the video plays
// right in the card, reel or page (YouTube's own embedded player), so he never leaves the app.
// Pure helpers, tested. Uses youtube-nocookie.com: YouTube sets no tracking cookies until he plays.

const ID = /^[A-Za-z0-9_-]{11}$/;

/** The video id from any YouTube link (watch, youtu.be, Shorts, embed, live, mobile), or null. */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch") id = u.searchParams.get("v");
    else if (["shorts", "embed", "live", "v"].includes(parts[0])) id = parts[1] ?? null;
  }
  return id && ID.test(id) ? id : null;
}

export const isYouTube = (url: string | null | undefined) => youtubeId(url) !== null;

/** A Shorts link (upright video). */
export const isYouTubeShort = (url: string | null | undefined) => isYouTube(url) && /\/shorts\//.test(url ?? "");

/** The tidy link we store: Shorts stay Shorts (so the app knows they're upright), others become watch links. */
export function cleanYouTubeUrl(url: string): string | null {
  const id = youtubeId(url);
  if (!id) return null;
  return isYouTubeShort(url) ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
}

/** YouTube's picture of the video (always there, 480×360). */
export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export interface EmbedOptions {
  controls?: boolean;
  loop?: boolean;
  start?: number;
  origin?: string;
}

/** The player address. It starts silent and paused; the app tells it when to play (see YouTubeFrame). */
export function embedUrl(id: string, o: EmbedOptions = {}): string {
  const p = new URLSearchParams({
    enablejsapi: "1",
    playsinline: "1",
    mute: "1",
    rel: "0",
    modestbranding: "1",
    iv_load_policy: "3",
    controls: o.controls ? "1" : "0",
    fs: o.controls ? "1" : "0",
    disablekb: o.controls ? "0" : "1",
  });
  if (o.loop) {
    p.set("loop", "1");
    p.set("playlist", id);
  }
  if (o.start) p.set("start", String(Math.max(0, Math.round(o.start))));
  if (o.origin) p.set("origin", o.origin);
  return `https://www.youtube-nocookie.com/embed/${id}?${p.toString()}`;
}

/** YouTube's error codes that mean "the owner doesn't allow this video in other apps", or it's gone/private. */
export const notEmbeddable = (code: number) => code === 101 || code === 150 || code === 153;
