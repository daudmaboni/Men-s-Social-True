"use client";

// Phone notifications (Step 79): the man allows them once, and his phone gets
//  - a daily reminder at the time he chose (only on days he hasn't opened the app; Sundays: his week in review)
//  - the team's messages from the Studio (only the kinds he chose, never between 22:00 and 07:00 his time)
// The lock screen shows "Men's Social" and a neutral line unless he allows the message text.
// The server side is netlify/functions/push-sender.mts + migration 0017.
//
// Where it works:
//  - Android browsers and the home-screen app: yes
//  - iPhone: only when the app is added to the home screen (iOS 16.4 or newer)
//  - our Android app (Capacitor): not yet (needs Firebase); he gets the in-app bell there
//  - nowhere if NEXT_PUBLIC_VAPID_PUBLIC_KEY isn't set

import { Capacitor } from "@capacitor/core";
import { getSupabase } from "../supabase/client";

export type PushSupport = "ok" | "ios-home-screen" | "android-app" | "unsupported" | "not-set-up";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (!KEY) return "not-set-up";
  try {
    if (Capacitor.isNativePlatform()) return "android-app";
  } catch {}
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return ios && !standalone ? "ios-home-screen" : "unsupported";
  return "ok";
}

export function pushPermission(): NotificationPermission | "unsupported" {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

/** The base64url VAPID key as bytes, as the push manager wants it. */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** The service worker, if it's running (it isn't in development unless ms_sw = "1"). */
async function worker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "ok") return null;
  const reg = await worker();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

async function register(sub: PushSubscription) {
  const sb = getSupabase();
  if (!sb) throw new Error("not-set-up");
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const { error } = await sb.rpc("push_subscribe", { p_endpoint: json.endpoint, p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth });
  if (error) throw new Error(error.message);
}

/** Ask the phone for permission and register it. */
export async function enablePush(): Promise<"on" | "denied" | "failed"> {
  if (pushSupport() !== "ok") return "failed";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  try {
    const reg = await worker();
    if (!reg) return "failed";
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) }));
    await register(sub);
    await saveReminder({ tz: localZone() }).catch(() => {});
    return "on";
  } catch {
    return "failed";
  }
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  const sb = getSupabase();
  await sb?.rpc("push_unsubscribe", { p_endpoint: sub.endpoint }).then(
    () => {},
    () => {},
  );
  await sub.unsubscribe().catch(() => false);
}

/** On every open while signed in: make sure this phone is still registered to him (the push address can change). */
export async function keepPushRegistered() {
  if (pushPermission() !== "granted") return;
  const sub = await currentSubscription();
  if (sub) await register(sub).catch(() => {});
}

export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Dar_es_Salaam";
  } catch {
    return "Africa/Dar_es_Salaam";
  }
}

/* ───────── His reminder choices (notification_prefs, migration 0017) ───────── */
export type Reminder = { daily_reminder: boolean; remind_at: string; lock_text: boolean; tz: string };
export const DEFAULT_REMINDER: Reminder = { daily_reminder: true, remind_at: "19:00", lock_text: false, tz: "Africa/Dar_es_Salaam" };

/** null = not signed in, or the database isn't updated yet (0017 not run). */
export async function loadReminder(): Promise<Reminder | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: s } = await sb.auth.getSession();
  if (!s.session) return null;
  const { data, error } = await sb.from("notification_prefs").select("daily_reminder,remind_at,lock_text,tz").eq("user_id", s.session.user.id).maybeSingle();
  if (error) return null;
  if (!data) return { ...DEFAULT_REMINDER, tz: localZone() };
  return { ...DEFAULT_REMINDER, ...data, remind_at: String(data.remind_at ?? "19:00").slice(0, 5) };
}

export async function saveReminder(change: Partial<Reminder>) {
  const sb = getSupabase();
  const { data: s } = (await sb?.auth.getSession()) ?? { data: { session: null } };
  if (!sb || !s.session) throw new Error("Please sign in.");
  const { error } = await sb.from("notification_prefs").upsert({ user_id: s.session.user.id, ...change, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/** Reminder times he can pick: 07:00 to 21:00 (never in the quiet hours). */
export const REMINDER_TIMES = Array.from({ length: 15 }, (_, i) => `${String(7 + i).padStart(2, "0")}:00`);
