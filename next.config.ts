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
const turnstile = "https://challenges.cloudflare.com"; // the optional "are you a person?" check

const csp = [
  "default-src 'self'",
  // Next.js needs inline scripts for page start-up (and eval while developing); no other sites allowed
  `script-src 'self' 'unsafe-inline' ${dev ? "'unsafe-eval'" : ""} ${turnstile}`,
  "style-src 'self' 'unsafe-inline'",
  // Data can only go to our own server and our Supabase project
  `connect-src 'self' ${supabase} ${supabaseWs} ${turnstile} ${dev ? "ws: http://localhost:*" : ""}`,
  `img-src 'self' data: blob: ${supabase}`,
  // Audio and video: uploads, plus direct links staff paste into the Studio
  `media-src 'self' blob: ${supabase} https:`,
  "font-src 'self' data:",
  `frame-src ${turnstile}`,
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

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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
