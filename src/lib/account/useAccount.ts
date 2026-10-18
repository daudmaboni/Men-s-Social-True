"use client";

// Is a man signed in to his own account? Sign up / log in with email, Google or phone.

import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "../supabase/client";
import { normalizeTzPhone } from "./merge";
import { currentLang } from "../me/lang";
import { checkPassword } from "../security/password";
import { markOAuthPending } from "./known";
import { forgetLinks } from "../course/media";
import { cooldown, formatWait, recordFailure, recordSuccess, waitSeconds } from "../security/loginGuard";

export type AccountState =
  | { status: "loading" }
  | { status: "unavailable" } // Supabase not set up: guest only
  | { status: "guest" }
  | { status: "signedIn"; user: User };

/** Which sign-in methods are switched on (set in .env.local / Vercel once each is set up in Supabase). */
export const AUTH_METHODS = {
  email: true,
  google: process.env.NEXT_PUBLIC_AUTH_GOOGLE === "on",
  phone: process.env.NEXT_PUBLIC_AUTH_PHONE === "on",
};

/* ───────────── Step 58: trust the phone ─────────────
 * Before, every screen waited for Supabase to answer "is he still signed in?" before showing
 * anything. When his sign-in had expired (app closed for over an hour), that meant waiting for a
 * full trip to the server first.
 * Now the app reads the sign-in already saved on this phone and opens straight away. Supabase
 * still checks it in the background: if the server says the sign-in is no longer valid
 * (signed out on another phone, account deleted), the app switches to guest a moment later.
 * This only decides what the screens show. The database checks every request itself
 * (row-level security), so a phone that is wrong about its sign-in can't read anything extra.
 */

/** The key supabase-js saves the session under in localStorage (its default: sb-<project ref>-auth-token). */
function sessionKey(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    return url ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token` : null;
  } catch {
    return null;
  }
}

/** The signed-in man saved on this phone, read straight from storage (no network). */
export function storedUser(): User | null {
  const key = sessionKey();
  if (!key || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw) as { user?: User; refresh_token?: string; currentSession?: { user?: User; refresh_token?: string } };
    const session = s.currentSession ?? s;
    // Without a refresh token the session can't be renewed, so don't pretend he's signed in
    return session.user?.id && session.refresh_token ? session.user : null;
  } catch {
    return null;
  }
}

let accState: AccountState | null = null;
const accListeners = new Set<() => void>();
let watching = false;

function setAcc(next: AccountState) {
  const same =
    accState?.status === next.status &&
    (next.status !== "signedIn" || (accState?.status === "signedIn" && accState.user === next.user));
  if (same) return;
  // Signed out (here, on another phone, or account deleted): the remembered Community list goes too
  if (next.status === "guest") {
    try {
      localStorage.removeItem("ms_community_v1");
      forgetLinks(); // one-day lesson links (Step 59)
    } catch {}
  }
  accState = next;
  accListeners.forEach((l) => l());
}

/** One watcher for the whole app (before, every screen asked Supabase on its own). */
function watch() {
  if (watching) return;
  watching = true;
  const sb = getSupabase();
  if (!sb) return;
  const apply = (user: User | null | undefined) => setAcc(user ? { status: "signedIn", user } : { status: "guest" });
  sb.auth.getSession().then(({ data }) => apply(data.session?.user));
  sb.auth.onAuthStateChange((_e, session) => apply(session?.user));
}

function readAcc(): AccountState {
  if (accState) return accState;
  if (!supabaseConfigured) accState = { status: "unavailable" };
  else {
    const user = storedUser();
    accState = user ? { status: "signedIn", user } : { status: "loading" };
  }
  return accState;
}

const SERVER_ACC: AccountState = supabaseConfigured ? { status: "loading" } : { status: "unavailable" };

export function useAccount(): AccountState {
  const state = useSyncExternalStore(
    (cb) => {
      accListeners.add(cb);
      watch();
      return () => accListeners.delete(cb);
    },
    readAcc,
    () => SERVER_ACC,
  );
  return state;
}

/** How we show who he is: email, phone, or "Google account". */
export function accountLabel(user: User): string {
  return user.email || (user.phone ? `+${user.phone.replace(/^\+/, "")}` : "Your account");
}

const friendly = (message: string): string => {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) return "This email already has an account. Log in instead.";
  if (m.includes("invalid login")) return "Wrong email or password.";
  if (m.includes("email not confirmed")) return "Please confirm your email first. Check your inbox.";
  if (m.includes("pwned") || m.includes("leaked") || m.includes("data breach")) return "This password has appeared in a data leak elsewhere. Please choose a different one.";
  if (m.includes("password should") || m.includes("weak")) return "Choose a stronger password: at least 8 characters, with letters and numbers.";
  if (m.includes("captcha")) return "Please complete the check that you're a person, then try again.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many tries. Please wait a few minutes and try again.";
  if (m.includes("token has expired") || m.includes("invalid otp") || m.includes("otp")) return "That code is wrong or expired. Ask for a new one.";
  if (m.includes("fetch") || m.includes("network")) return "Can't connect. Check your internet and try again.";
  if (m.includes("provider is not enabled") || m.includes("unsupported provider")) return "This sign-in option isn't switched on yet.";
  return message;
};

/** error is English (translated on screen with vars). */
type Result = { error: string | null; vars?: Record<string, string | number>; needsConfirm?: boolean };

const tooMany = (s: number): Result => ({ error: "Too many wrong tries. Wait {time} and try again.", vars: { time: formatWait(s, currentLang()) } });
const weak = (pw: string, email?: string): Result | null => {
  const c = checkPassword(pw, { email });
  return c.ok ? null : { error: c.problem, vars: { n: 8 } };
};

export const account = {
  async signUpEmail(email: string, password: string, captchaToken?: string): Promise<Result> {
    const sb = getSupabase();
    if (!sb) return { error: "Accounts aren't available yet." };
    const bad = weak(password, email);
    if (bad) return bad;
    const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${location.origin}/social`, captchaToken } });
    if (error) return { error: friendly(error.message) };
    // Supabase hides "already registered" by returning a user with no identities
    if (data.user && data.user.identities?.length === 0) return { error: friendly("already registered") };
    return { error: null, needsConfirm: !data.session };
  },

  async signInEmail(email: string, password: string, captchaToken?: string): Promise<Result> {
    const sb = getSupabase();
    if (!sb) return { error: "Accounts aren't available yet." };
    const wait = waitSeconds("login", email);
    if (wait) return tooMany(wait);
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password, options: { captchaToken } });
    if (!error) {
      recordSuccess("login", email);
      return { error: null };
    }
    if (/invalid login/i.test(error.message)) {
      const w = recordFailure("login", email);
      if (w) return tooMany(w);
    }
    return { error: friendly(error.message) };
  },

  async resetPassword(email: string, captchaToken?: string): Promise<Result> {
    const sb = getSupabase();
    if (!sb) return { error: "Accounts aren't available yet." };
    const wait = cooldown("reset", email, 60);
    if (wait) return { error: "A link was just sent. Wait {time} before asking again.", vars: { time: formatWait(wait, currentLang()) } };
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/account/new-password`, captchaToken });
    if (error) recordSuccess("reset", email);
    return { error: error ? friendly(error.message) : null };
  },

  async setNewPassword(password: string, email?: string): Promise<Result> {
    const sb = getSupabase();
    if (!sb) return { error: "Accounts aren't available yet." };
    const bad = weak(password, email);
    if (bad) return bad;
    const { error } = await sb.auth.updateUser({ password });
    return { error: error ? friendly(error.message) : null };
  },

  /** Google sends him back to `next` (the tab or page he started from). */
  async signInGoogle(next = "/social"): Promise<Result> {
    const sb = getSupabase();
    if (!sb) return { error: "Accounts aren't available yet." };
    const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/social";
    markOAuthPending(); // so we can greet him ("Welcome back" or "Account ready") when Google sends him back
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}${safe}` } });
    return { error: error ? friendly(error.message) : null };
  },

  async sendPhoneCode(phoneInput: string, captchaToken?: string): Promise<Result & { phone?: string }> {
    const sb = getSupabase();
    if (!sb) return { error: "Accounts aren't available yet." };
    const phone = normalizeTzPhone(phoneInput);
    if (!phone) return { error: "Enter a Tanzanian mobile number, e.g. 0712 345 678." };
    // One SMS a minute per number (each one costs money)
    const wait = cooldown("sms", phone, 60);
    if (wait) return { error: "A code was just sent. Wait {time} before asking again.", vars: { time: formatWait(wait, currentLang()) }, phone };
    const { error } = await sb.auth.signInWithOtp({ phone, options: { captchaToken } });
    if (error) recordSuccess("sms", phone); // nothing was sent: he can try again straight away
    return { error: error ? friendly(error.message) : null, phone };
  },

  async verifyPhoneCode(phone: string, code: string): Promise<Result> {
    const sb = getSupabase();
    if (!sb) return { error: "Accounts aren't available yet." };
    const wait = waitSeconds("code", phone);
    if (wait) return tooMany(wait);
    const { error } = await sb.auth.verifyOtp({ phone, token: code.trim(), type: "sms" });
    if (!error) {
      recordSuccess("code", phone);
      return { error: null };
    }
    const w = recordFailure("code", phone);
    if (w) return tooMany(w);
    return { error: friendly(error.message) };
  },

  async signOut() {
    await getSupabase()?.auth.signOut();
  },

  async deleteAccount(): Promise<Result> {
    const sb = getSupabase();
    if (!sb) return { error: "Accounts aren't available yet." };
    const { error } = await sb.rpc("delete_my_account");
    if (error) return { error: friendly(error.message) };
    await sb.auth.signOut();
    return { error: null };
  },
};
