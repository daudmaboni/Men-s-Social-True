"use client";

// Asking Kito from the app (Step 67): sends his question with his sign-in, so only members can ask.

import { getSupabase } from "../supabase/client";
import type { KitoSource, Lang, Turn } from "./prompt";

export interface KitoAnswer {
  answer: string;
  sources: KitoSource[];
  confident: boolean;
  flag?: "crisis" | "urgent" | null;
}

export class KitoError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

/** `about`: the card he asked from (Step 90), so Kito answers about that card first. */
export async function askKito(question: string, lang: Lang, history: Turn[], about?: string | null): Promise<KitoAnswer> {
  const sb = getSupabase();
  const { data } = sb ? await sb.auth.getSession() : { data: { session: null } };
  const token = data.session?.access_token;
  if (!token) throw new KitoError("Sign in to ask Kito.", "signin");
  let res: Response;
  try {
    res = await fetch("/api/kito", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ question, lang, history, ...(about ? { about } : {}) }),
    });
  } catch {
    throw new KitoError("No connection. Check your internet and try again.", "offline");
  }
  const json = (await res.json().catch(() => ({}))) as Partial<KitoAnswer> & { error?: string; code?: string };
  if (!res.ok) throw new KitoError(json.error ?? "Kito couldn't answer. Try again.", json.code);
  return { answer: json.answer ?? "", sources: json.sources ?? [], confident: Boolean(json.confident), flag: json.flag ?? null };
}
