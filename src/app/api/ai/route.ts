// AI for the Admin Control Center. Runs on the server so the API key never reaches a browser.
// Checks, in order: a signed-in admin with the "ai.use" permission (asked of the database with HIS token),
// AI switched on (Settings), the key configured (ANTHROPIC_API_KEY), and at most 30 requests per hour for the whole team (cost control).
// Results are drafts only; content made from them is marked AI-assisted and can't be published until checked.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AI_ACTIONS, buildPrompt, DEFAULT_AI, parseResult, type AiAction, type AiConfig } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.AI_MODEL || "claude-sonnet-5-5";
const BASE = process.env.AI_BASE_URL || "https://api.anthropic.com";

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

function clientFor(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!URL_ || !ANON || !token) return null;
  return createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
}

async function aiConfig(sb: NonNullable<ReturnType<typeof clientFor>>): Promise<AiConfig> {
  const { data } = await sb.from("app_settings").select("value").eq("key", "ai_config").maybeSingle();
  return { ...DEFAULT_AI, ...((data?.value as Partial<AiConfig>) ?? {}) };
}

/** Status for the AI page: never returns the key, only whether one is set. */
export async function GET(req: Request) {
  const sb = clientFor(req);
  if (!sb) return fail(401, "Sign in to the Admin Control Center first.");
  const { data: allowed } = await sb.rpc("admin_can", { perm: "ai.use" });
  if (!allowed) return fail(403, "Not allowed: your admin role can't use AI.");
  const cfg = await aiConfig(sb);
  return NextResponse.json({ configured: Boolean(KEY), enabled: cfg.enabled, model: KEY ? MODEL : null });
}

export async function POST(req: Request) {
  const sb = clientFor(req);
  if (!sb) return fail(401, "Sign in to the Admin Control Center first.");
  const { data: allowed, error: permErr } = await sb.rpc("admin_can", { perm: "ai.use" });
  if (permErr) return fail(503, "Run migration 0006 in Supabase first.");
  if (!allowed) return fail(403, "Not allowed: your admin role can't use AI.");

  let body: { action?: AiAction; text?: string; topic?: string; kind?: string; brief?: string; to?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, "Bad request.");
  }
  const action = body.action;
  if (!action || !AI_ACTIONS.includes(action)) return fail(400, "Unknown AI action.");
  if (action !== "draft" && (!body.text || body.text.trim().length < 20)) return fail(400, "Give the AI some text to work with (at least a few sentences).");

  const log = (ok: boolean, error: string | null, inChars: number, outChars: number) =>
    sb.from("ai_usage").insert({ action, ok, error: error?.slice(0, 300) ?? null, input_chars: inChars, output_chars: outChars });

  const cfg = await aiConfig(sb);
  if (!cfg.enabled) return fail(403, "AI is switched off. An owner can switch it on in Settings → Features.");
  if (!KEY) {
    await log(false, "not configured", 0, 0);
    return fail(503, "AI isn't connected: the server has no ANTHROPIC_API_KEY. Add it to the hosting environment (never to the app code).");
  }
  const { count } = await sb.from("ai_usage").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= 30) return fail(429, "Limit reached: 30 AI requests per hour for the whole team. Try again later.");

  const { data: srcRows } = await sb.from("ai_sources").select("title,url").eq("approved", true).limit(30);
  const sources = (srcRows ?? []).map((s: { title: string; url: string | null }) => (s.url ? `${s.title} (${s.url})` : s.title));
  const prompt = buildPrompt(action, body, cfg, sources);

  try {
    const res = await fetch(`${BASE}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, system: prompt.system, messages: [{ role: "user", content: prompt.user }] }),
      signal: AbortSignal.timeout(60_000),
    });
    const json = (await res.json().catch(() => ({}))) as { content?: { type: string; text?: string }[]; error?: { message?: string } };
    if (!res.ok) {
      const msg = `AI service error (${res.status}): ${json.error?.message ?? "no details"}`;
      await log(false, msg, prompt.user.length, 0);
      return fail(502, msg);
    }
    const text = (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
    const result = parseResult(action, text);
    await log(true, null, prompt.user.length, text.length);
    return NextResponse.json({ result, model: MODEL });
  } catch (e) {
    const msg = (e as Error).name === "TimeoutError" ? "The AI took too long. Try again." : (e as Error).message;
    await log(false, msg, prompt.user.length, 0);
    return fail(502, msg);
  }
}
