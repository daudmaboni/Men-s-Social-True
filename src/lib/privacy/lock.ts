"use client";

// Step 90: a private lock for the Man and Me tabs. A phone left on the table, or shared with someone, doesn't
// show his progress, check-ins, points or course. Discover and Community stay open.
//  - A 4-digit PIN, kept on this phone only, never as the PIN itself: a salted PBKDF2 hash.
//  - Optionally his fingerprint or face (the phone's own screen lock, through the browser), on phones that have it.
//  - Locks again when he reopens the app, or comes back after more than a minute away.
//  - 5 wrong PINs: wait 30 seconds before trying again (longer each time).
// It's a privacy screen, not encryption: his data is still on the phone (and in his account if he has one).

import { useSyncExternalStore } from "react";

const KEY = "ms_lock_v1";
export const PIN_LENGTH = 4;
/** Away from the app longer than this → locked again. */
export const RELOCK_AFTER_MS = 60_000;
const ITERATIONS = 120_000;

export interface LockConfig {
  salt: string;
  hash: string;
  /** The fingerprint/face key's id on this phone, if he turned it on. */
  bio?: string;
  /** Wrong tries in a row, and until when he must wait. */
  fails?: number;
  waitUntil?: number;
}

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const validPin = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);

/** PBKDF2-SHA256 of the PIN with this phone's salt. */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unb64(salt), iterations: ITERATIONS }, key, 256);
  return b64(bits);
}

export async function makeLock(pin: string): Promise<LockConfig> {
  if (!validPin(pin)) throw new Error("bad pin");
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, hash: await hashPin(pin, salt) };
}

/** Wait after wrong tries: none for the first 4, then 30 s, 60 s, 120 s… (at most 15 minutes). */
export function waitAfter(fails: number): number {
  if (fails < 5) return 0;
  return Math.min(15 * 60_000, 30_000 * 2 ** (fails - 5));
}

/** Check a PIN. Returns the updated config (wrong-try count) and whether it matched. */
export async function checkPin(cfg: LockConfig, pin: string, now = Date.now()): Promise<{ ok: boolean; cfg: LockConfig; wait: number }> {
  if (cfg.waitUntil && cfg.waitUntil > now) return { ok: false, cfg, wait: cfg.waitUntil - now };
  const ok = validPin(pin) && (await hashPin(pin, cfg.salt)) === cfg.hash;
  if (ok) return { ok, cfg: { ...cfg, fails: 0, waitUntil: undefined }, wait: 0 };
  const fails = (cfg.fails ?? 0) + 1;
  const wait = waitAfter(fails);
  return { ok, cfg: { ...cfg, fails, waitUntil: wait ? now + wait : undefined }, wait };
}

/* ───────── State on this phone ───────── */
let cfg: LockConfig | null | undefined; // undefined = not read yet
let unlocked = false;
let hiddenAt = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(): LockConfig | null {
  if (cfg !== undefined) return cfg;
  try {
    const raw = localStorage.getItem(KEY);
    const p = raw ? (JSON.parse(raw) as LockConfig) : null;
    cfg = p && typeof p.salt === "string" && typeof p.hash === "string" ? p : null;
  } catch {
    cfg = null;
  }
  return cfg;
}
function write(next: LockConfig | null) {
  cfg = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {}
  emit();
}

let watching = false;
function watch() {
  if (watching || typeof document === "undefined") return;
  watching = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS && read() && unlocked) {
      unlocked = false;
      emit();
    }
  });
}

export const privacyLock = {
  config: read,
  /** Turn the lock on with this PIN (he's already in, so it starts unlocked). */
  async enable(pin: string) {
    write(await makeLock(pin));
    unlocked = true;
    emit();
  },
  async changePin(pin: string) {
    const c = read();
    const next = await makeLock(pin);
    write(c?.bio ? { ...next, bio: c.bio } : next);
  },
  disable() {
    unlocked = false;
    write(null);
  },
  async unlock(pin: string): Promise<{ ok: boolean; wait: number }> {
    const c = read();
    if (!c) return { ok: true, wait: 0 };
    const r = await checkPin(c, pin);
    write(r.cfg);
    if (r.ok) {
      unlocked = true;
      emit();
    }
    return { ok: r.ok, wait: r.wait };
  },
  lockNow() {
    if (!read()) return;
    unlocked = false;
    emit();
  },

  /* Fingerprint / face (the phone's own lock), through WebAuthn. */
  async bioAvailable(): Promise<boolean> {
    try {
      return typeof PublicKeyCredential !== "undefined" && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
    } catch {
      return false;
    }
  },
  async enableBio(): Promise<boolean> {
    const c = read();
    if (!c) return false;
    try {
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: "Men's Social" },
          user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "Men's Social", displayName: "Men's Social" },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
          timeout: 60_000,
        },
      })) as PublicKeyCredential | null;
      if (!cred) return false;
      write({ ...c, bio: b64(cred.rawId) });
      return true;
    } catch {
      return false;
    }
  },
  disableBio() {
    const c = read();
    if (c) write({ ...c, bio: undefined });
  },
  async unlockBio(): Promise<boolean> {
    const c = read();
    if (!c?.bio) return false;
    try {
      const got = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ type: "public-key", id: unb64(c.bio) }],
          userVerification: "required",
          timeout: 60_000,
        },
      });
      if (!got) return false;
      unlocked = true;
      write({ ...c, fails: 0, waitUntil: undefined });
      return true;
    } catch {
      return false;
    }
  },
};

type LockState = { ready: boolean; enabled: boolean; locked: boolean; bio: boolean };
const SERVER: LockState = { ready: false, enabled: false, locked: false, bio: false };
let snap: LockState = SERVER;
function snapshot(): LockState {
  watch();
  const c = read();
  const next: LockState = { ready: true, enabled: Boolean(c), locked: Boolean(c) && !unlocked, bio: Boolean(c?.bio) };
  if (next.enabled !== snap.enabled || next.locked !== snap.locked || next.bio !== snap.bio || !snap.ready) snap = next;
  return snap;
}

export function usePrivacyLock(): LockState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    () => SERVER,
  );
}
