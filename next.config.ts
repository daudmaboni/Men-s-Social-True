import type { NextConfig } from "next";

// ---- Security headers (sent with every page) ----
// The sign-in session lives in the browser because the app talks to Supabase directly (that's how
// row-level security knows who he is). So the real protection is making sure no foreign script can run,
// and that even if one did, it couldn't send his session anywhere except our own Supabase.

const dev = process.env.NODE_ENV !== "production";
const supabase = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();
const supabaseWs = supabase.replace(/^https:/, "wss:");
// Card photos are read from the live project's public storage even when running without .env.local
const photos = "https://oovvbluaiytosfmwpfbj.supabase.co";
const turnstile = "https://challenges.cloudflare.com"; // the optional "are you a person?" check
// YouTube videos staff paste in the Studio play inside the app (Step 74): the player, and its pictures
const youtube = "https://www.youtube-nocookie.com https://www.youtube.com";
const ytImages = "https://i.ytimg.com";

// Step 85: the Studio's Card maker listens to voice notes in the browser (Whisper). Only Studio pages may load
// the speech engine (cdn.jsdelivr.net, pinned version) and the model files (Hugging Face), and run WebAssembly.
const listening = "https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co https://*.hf.co";

const cspFor = (studio: boolean) => [
  "default-src 'self'",
  // Next.js needs inline scripts for page start-up (and eval while developing); no other sites allowed
  `script-src 'self' 'unsafe-inline' ${dev ? "'unsafe-eval'" : ""} ${turnstile} ${studio ? "'wasm-unsafe-eval' https://cdn.jsdelivr.net" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Data can only go to our own server and our Supabase project
  `connect-src 'self' ${supabase} ${supabaseWs} ${turnstile} ${dev ? "ws: http://localhost:*" : ""} ${studio ? listening : ""}`,
  `img-src 'self' data: blob: ${supabase} ${photos} ${ytImages}`,
  // Audio and video: uploads, plus direct links staff paste into the Studio
  `media-src 'self' blob: ${supabase} https:`,
  "font-src 'self' data:",
  `frame-src ${turnstile} ${youtube}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  dev ? "" : "upgrade-insecure-requests",
]
  .filter(Boolean)
  .join("; ")
  .replace(/\s+/g, " ");

const headersFor = (studio: boolean) => [
  { key: "Content-Security-Policy", value: cspFor(studio) },
  // Nobody can show the app inside their own site (stops "click here" tricks over a hidden login)
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites only learn "menssocial…", never which article or post he was reading
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Netlify deploy fix: the Card maker's Whisper runs only in the Studio browser (onnxruntime-web).
  // Without this, the server bundle drags in onnxruntime-node (~540 MB) and sharp, and Netlify rejects
  // the server function as too large. Point them at "nothing" and keep them out of the server files.
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, "onnxruntime-node$": false, "sharp$": false };
    return config;
  },
  outputFileTracingExcludes: {
    "*": ["node_modules/onnxruntime-node/**", "node_modules/@huggingface/transformers/**", "node_modules/@img/**", "node_modules/sharp/**"],
  },
  // Lighter photos (Step 85): Netlify's image service only exists on Netlify, so it's on only for Netlify builds
  env: { NEXT_PUBLIC_IMAGE_CDN: process.env.NETLIFY === "true" ? "on" : process.env.NEXT_PUBLIC_IMAGE_CDN || "off" },
  async headers() {
    // The Studio gets the extra room for listening (Step 85); every other page keeps the strict rules
    return [
      { source: "/((?!studio).*)", headers: headersFor(false) },
      { source: "/studio", headers: headersFor(true) },
      { source: "/studio/:path*", headers: headersFor(true) },
    ];
  },
  // Old addresses from before the 3-tab layout still work
  async redirects() {
    return [
      { source: "/home", destination: "/man", permanent: false },
      { source: "/progress", destination: "/man", permanent: false },
      { source: "/profile", destination: "/me", permanent: false },
    ];
  },
};

export default nextConfig;
