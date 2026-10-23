// Card maker (Admin → Card maker): staff send text, a PDF, a photo, a link, or notes about an audio/video,
// and the AI turns it into one "do this" card in the Discover format. Runs on the server so the API key
// never reaches a browser. Same checks as /api/ai: a signed-in admin with "ai.use", AI switched on,
// the key configured, and at most 30 AI requests per hour for the whole team.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildCardMessage, CARD_SYSTEM, parseCard, type CardSource } from "@/lib/ai/card";
import { DEFAULT_AI, type AiConfig } from "@/lib/ai/prompts";
import { pageText, safeUrl } from "@/lib/ai/linkText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.AI_MODEL || "claude-sonnet-5-5";
const BASE = process.env.AI_BASE_URL || "https://api.anthropic.com";
const WORKSPACE = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
const MAX_FILE_B64 = 6_000_000; // about 4.5 MB of file

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

function clientFor(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!URL_ || !ANON || !token) return null;
  return createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
}

type Body = {
  kind?: "text" | "pdf" | "image" | "link" | "audio" | "video";
  text?: string;
  url?: string;
  base64?: string;
  mediaType?: string;
  name?: string;
  notes?: string;
  /** Video: up to 6 still pictures (JPEG, base64), taken in the Studio (Step 85). */
  frames?: string[];
};

export async function POST(req: Request) {
  const sb = clientFor(req);
  if (!sb) return fail(401, "Sign in to the Admin Control Center first.");
  const { data: allowed, error: permErr } = await sb.rpc("admin_can", { perm: "ai.use" });
  if (permErr) return fail(503, "Run migration 0006 in Supabase first.");
  if (!allowed) return fail(403, "Not allowed: your admin role can't use AI.");

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return fail(400, "That file is too big to send. Keep PDFs and photos under 4 MB.");
  }

  // What the AI will read
  let src: CardSource;
  const notes = (body.notes ?? "").slice(0, 4000);
  const name = (body.name ?? "file").slice(0, 120);
  switch (body.kind) {
    case "text":
      if (!body.text || body.text.trim().length < 20) return fail(400, "Paste a bit more text (at least a sentence or two).");
      src = { kind: "text", text: body.text };
      break;
    case "pdf":
      if (!body.base64 || body.base64.length > MAX_FILE_B64) return fail(400, "Send a PDF under 4 MB.");
      src = { kind: "pdf", base64: body.base64, name };
      break;
    case "image": {
      const mt = body.mediaType;
      if (!body.base64 || body.base64.length > MAX_FILE_B64 || (mt !== "image/jpeg" && mt !== "image/png" && mt !== "image/webp")) {
        return fail(400, "Send a JPG, PNG or WebP photo under 4 MB.");
      }
      src = { kind: "image", base64: body.base64, mediaType: mt, name };
      break;
    }
    case "link": {
      const url = safeUrl(body.url ?? "");
      if (!url) return fail(400, "That link doesn't look right. Use a full https:// address.");
      try {
        const text = await pageText(url);
        if (text.length < 80) {
          return fail(422, /instagram\.com|facebook\.com|tiktok\.com/.test(url.hostname)
            ? "Instagram, Facebook and TikTok hide their posts from other servers. Copy the caption and use Text instead, or upload the photo."
            : "Couldn't read anything useful on that page. Copy the text and use Text instead.");
        }
        src = { kind: "link", url: url.toString(), text };
      } catch (e) {
        return fail(422, `Couldn't open that link (${(e as Error).message}). Copy the text and use Text instead.`);
      }
      break;
    }
    case "audio":
    case "video": {
      const frames = body.kind === "video" && Array.isArray(body.frames) ? body.frames.filter((f) => typeof f === "string" && f.length > 100 && f.length < 900_000).slice(0, 6) : [];
      if (notes.trim().length < 20 && frames.length === 0) {
        return fail(400, body.kind === "audio" ? "Tap “Listen to it” first (or write what it says in the notes box)." : "Tap “Listen to it” first, or write what the video says in the notes box.");
      }
      src = { kind: "media", mediaKind: body.kind, name, notes, frames };
      break;
    }
    default:
      return fail(400, "Choose what you're sending: text, file or link.");
  }

  const { data: cfgRow } = await sb.from("app_settings").select("value").eq("key", "ai_config").maybeSingle();
  const cfg: AiConfig = { ...DEFAULT_AI, ...((cfgRow?.value as Partial<AiConfig>) ?? {}) };
  if (!cfg.enabled) return fail(403, "AI is switched off. An owner can switch it on in Settings → Features.");
  const inChars = (body.text?.length ?? 0) + (body.base64?.length ?? 0) + notes.length + (body.frames ?? []).reduce((s, f) => s + (typeof f === "string" ? f.length : 0), 0);
  const log = (ok: boolean, error: string | null, outChars: number) =>
    sb.from("ai_usage").insert({ action: `card:${body.kind}`, ok, error: error?.slice(0, 300) ?? null, input_chars: inChars, output_chars: outChars });
  if (!KEY) {
    await log(false, "not configured", 0);
    return fail(503, "AI isn't connected: the server has no ANTHROPIC_API_KEY. Add it to the hosting environment (never to the app code).");
  }
  const { count } = await sb.from("ai_usage").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= 30) return fail(429, "Limit reached: 30 AI requests per hour for the whole team. Try again later.");

  const system = [CARD_SYSTEM, cfg.rules ? `Extra rules from the editors: ${cfg.rules}` : ""].filter(Boolean).join("\n\n");
  try {
    const res = await fetch(`${BASE}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01",
        ...(WORKSPACE ? { "anthropic-workspace-id": WORKSPACE } : {}),
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 3000, system, messages: [{ role: "user", content: buildCardMessage(src, src.kind === "media" ? "" : notes) }] }),
      signal: AbortSignal.timeout(55_000),
    });
    const json = (await res.json().catch(() => ({}))) as { content?: { type: string; text?: string }[]; error?: { message?: string } };
    if (!res.ok) {
      const detail = json.error?.message ?? "no details";
      const msg = /credit balance/i.test(detail)
        ? "The AI account has no credit yet. Add credit in the Claude Console → Billing, then try again."
        : /workspace/i.test(detail) && !WORKSPACE
          ? "AI isn't fully connected: this key needs ANTHROPIC_WORKSPACE_ID next to it. Add it, then redeploy."
          : `AI service error (${res.status}): ${detail}`;
      await log(false, msg, 0);
      return fail(502, msg);
    }
    const text = (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
    const card = parseCard(text);
    await log(true, null, text.length);
    return NextResponse.json({ card, model: MODEL });
  } catch (e) {
    const msg = (e as Error).name === "TimeoutError" ? "The AI took too long. Try again, or send a shorter file." : (e as Error).message;
    await log(false, msg, 0);
    return fail(502, msg);
  }
}
