"use client";

// "Are you a person?" check (Cloudflare Turnstile, free) shown above sign-in buttons.
// Off until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set on Netlify. Supabase checks the answer on its
// servers once CAPTCHA protection is switched on there (Authentication → Attack Protection),
// so bots can't skip it by calling Supabase directly. Most people just see a tick, no puzzle.

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export const CAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
export const captchaOn = Boolean(CAPTCHA_SITE_KEY);

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("captcha"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export type CaptchaHandle = { reset: () => void };

/** Calls onToken with a fresh token (or null when it expires). Tokens work once: call reset() after each try. */
const Captcha = forwardRef<CaptchaHandle, { onToken: (token: string | null) => void; lang?: string }>(function Captcha({ onToken, lang = "en" }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useImperativeHandle(ref, () => ({
    reset: () => {
      cb.current(null);
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
    },
  }));

  useEffect(() => {
    if (!captchaOn) return;
    let gone = false;
    loadScript()
      .then(() => {
        if (gone || !box.current || !window.turnstile) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: CAPTCHA_SITE_KEY,
          theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
          language: lang === "sw" ? "sw" : "en",
          size: "flexible",
          callback: (t: string) => cb.current(t),
          "expired-callback": () => cb.current(null),
          "error-callback": () => cb.current(null),
        });
      })
      .catch(() => cb.current(null));
    return () => {
      gone = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [lang]);

  if (!captchaOn) return null;
  return <div ref={box} className="min-h-[65px]" />;
});

export default Captcha;
