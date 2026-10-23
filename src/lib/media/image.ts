// Lighter photos (Step 85). Card and reel photos are stored at full size in Supabase (often 1–3 MB).
// On the live site we ask Netlify's free image service for a phone-sized copy instead:
//   /.netlify/images?url=<photo>&w=<width>&q=<quality>
// Netlify resizes it once, keeps it on its servers, and sends WebP or AVIF to phones that can show them,
// so a card photo is usually 60–150 KB instead of 1–3 MB. With Data Saver on (or a slow 2G/3G
// connection) he gets an even smaller copy. Photos also load only as he scrolls near them.
// Running locally (npm run dev) there is no Netlify, so the original photo is used: next.config.ts turns
// this on only when Netlify builds the site (NETLIFY=true), so the server and the phone always agree.
// Which outside photos Netlify may resize is set in netlify.toml ([images] remote_images).

/** Widths Netlify makes; the phone picks the one that fits its screen. */
export const WIDTHS = [360, 540, 720, 1080] as const;

const PHOTO_HOSTS = [/^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//];

/** Only on the live site (Netlify serves /.netlify/images); never while developing on this computer. */
export function cdnOn(): boolean {
  return process.env.NEXT_PUBLIC_IMAGE_CDN === "on";
}

/** Is this a photo Netlify is allowed to resize (our own files, or our Supabase storage)? */
export function resizable(url: string | undefined | null): url is string {
  if (!url) return false;
  if (url.startsWith("/") && !url.startsWith("//") && /\.(jpe?g|png|webp)(\?|$)/i.test(url)) return true;
  return PHOTO_HOSTS.some((r) => r.test(url));
}

/** He asked to save data, or the connection is slow. */
export function lowData(): boolean {
  try {
    const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    return Boolean(c?.saveData) || /(^|-)2g|3g/.test(c?.effectiveType ?? "");
  } catch {
    return false;
  }
}

/** One resized copy. */
export function sized(url: string, width: number, quality = 70, on = cdnOn()): string {
  if (!on || !resizable(url)) return url;
  return `/.netlify/images?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
}

/**
 * src / srcSet / sizes for an <img>. `fullWidth`: the photo spans the phone screen (cards, reels);
 * otherwise it's a small thumbnail. With low data, only the small copies are offered.
 */
export function imgProps(url: string | undefined, { fullWidth = true, low = false, on = cdnOn() }: { fullWidth?: boolean; low?: boolean; on?: boolean } = {}) {
  if (!url) return { src: undefined };
  if (!on || !resizable(url)) return { src: url };
  const q = low ? 50 : 70;
  const widths = fullWidth ? (low ? [360, 540] : WIDTHS) : [180, 360];
  return {
    src: sized(url, widths[Math.min(1, widths.length - 1)], q, on),
    srcSet: widths.map((w) => `${sized(url, w, q, on)} ${w}w`).join(", "),
    sizes: fullWidth ? "(min-width: 1024px) 480px, 100vw" : "96px",
  };
}
