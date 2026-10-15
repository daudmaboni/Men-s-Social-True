"use client";

// Remembers, on this phone only, that a man has signed in here before — so the Welcome page can
// say "Welcome back" and offer Log in first instead of "Create account".
// Only a masked hint is kept (e.g. "da•••@gmail.com" or his first name), never the full email.
// Also tells a brand-new account from a returning one after Google sign-in.

import type { User } from "@supabase/supabase-js";

const KEY = "ms_known_account";
const OAUTH_KEY = "ms_oauth_pending";

export type KnownAccount = { hint: string; method: "google" | "email" | "phone"; at: string };

/** "daudimaboni23@gmail.com" → "da•••@gmail.com"; "+255712345678" → "+255 ••• 678". */
export function maskHint(user: Pick<User, "email" | "phone" | "user_metadata">): string {
  const first = [user.user_metadata?.given_name, user.user_metadata?.full_name].find((v) => typeof v === "string" && v.trim()) as string | undefined;
  if (first) return first.trim().split(/\s+/)[0].slice(0, 24);
  if (user.email) {
    const [name, domain] = user.email.split("@");
    return `${name.slice(0, 2)}•••@${domain}`;
  }
  if (user.phone) {
    const digits = user.phone.replace(/\D/g, "");
    return `+${digits.slice(0, 3)} ••• ${digits.slice(-3)}`;
  }
  return "";
}

function methodOf(user: User): KnownAccount["method"] {
  const p = user.app_metadata?.provider;
  return p === "google" ? "google" : p === "phone" || (!user.email && user.phone) ? "phone" : "email";
}

export function rememberAccount(user: User) {
  try {
    const known: KnownAccount = { hint: maskHint(user), method: methodOf(user), at: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(known));
  } catch {}
}

export function knownAccount(): KnownAccount | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const k = JSON.parse(raw) as Partial<KnownAccount>;
    if (typeof k.hint !== "string" || typeof k.at !== "string") return null;
    return { hint: k.hint, method: k.method === "google" || k.method === "phone" ? k.method : "email", at: k.at };
  } catch {
    return null;
  }
}

/** "Not you?" on the Welcome page, or his account was deleted. */
export function forgetAccount() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/** Was this account created just now (this sign-in is its first)? */
export function isNewAccount(user: Pick<User, "created_at" | "last_sign_in_at">, slackMs = 120_000): boolean {
  if (!user.last_sign_in_at) return true;
  return Math.abs(Date.parse(user.last_sign_in_at) - Date.parse(user.created_at)) < slackMs;
}

/** Set just before leaving for Google, read once when he comes back. */
export function markOAuthPending() {
  try {
    localStorage.setItem(OAUTH_KEY, "1");
  } catch {}
}
export function takeOAuthPending(): boolean {
  try {
    const was = localStorage.getItem(OAUTH_KEY) === "1";
    localStorage.removeItem(OAUTH_KEY);
    return was;
  } catch {
    return false;
  }
}
