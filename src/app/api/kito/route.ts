// Kito, the members' learning assistant (Step 67). Separate from the staff AI (/api/ai): its own rules,
// its own switch (kito_enabled) and its own limits, all checked by the database (migration 0013).
//
// For each question:
//  1. He must be signed in (his own token is used for every database call, so the database's rules apply).
//  2. A crisis question (self-harm) is answered with care and help to reach people now — no AI.
//  3. kito_allow(): switch on, not restricted, within his hourly/daily limits.
//  4. The library is searched (Kayani's guides, "do this" cards and the course). No match = an honest
//     "I don't have a guide on that yet" — no AI call.
//  5. Otherwise the AI explains, using only those sources, and the answer links to them.
// Questions and answers are never stored; kito_usage keeps only who, when and how it went.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { LIBRARY } from "@/lib/content/library";
import { mergeLibrary, rowToItem } from "@/lib/content/rows";
import type { ContentItem } from "@/lib/content/types";
import { flatLessons, visibleCourse, type Course } from "@/lib/course/types";
import { buildIndex, docsFromItems, docsFromLessons, search, type KitoDoc } from "@/lib/kito/search";
import { buildKitoMessage, CRISIS_REPLY, KITO_SYSTEM, NOT_IN_LIBRARY, parseKito, safetyFlag, URGENT_LINE, type KitoSource, type Lang, type Turn } from "@/lib/kito/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.KITO_MODEL || process.env.AI_MODEL || "claude-sonnet-5-5";
const BASE = process.env.AI_BASE_URL || "https://api.anthropic.com";
const WORKSPACE = process.env.ANTHROPIC_WORKSPACE_ID?.trim();

const fail = (status: number, error: string, code?: string) => NextResponse.json({ error, code }, { status });

function clientFor(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!URL_ || !ANON || !token) return null;
  return createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
}

/** Everything men can see: built-in Kayani content (not the development samples) + what the Studio published + the course. */
async function libraryDocs(sb: NonNullable<ReturnType<typeof clientFor>>): Promise<KitoDoc[]> {
  const [{ data: rows }, { data: courses }] = await Promise.all([
    sb.from("content_items").select("*").eq("status", "published").limit(500),
    sb.from("course_versions").select("data").eq("state", "published"),
  ]);
  const published = (rows ?? []).map((r) => rowToItem(r)).filter((c): c is ContentItem => Boolean(c));
  const items = mergeLibrary(LIBRARY, published).filter((c) => !c.fixture && c.status !== "archived");
  const lessons = ((courses ?? []) as { data: Course }[])
    .map((r) => r.data)
    .filter((c) => c && Array.isArray(c.modules))
    .flatMap((c) => docsFromLessons(c.title, flatLessons(visibleCourse(c))));
  return [...docsFromItems(items), ...lessons];
}

export async function POST(req: Request) {
  const sb = clientFor(req);
  if (!sb) return fail(401, "Sign in to ask Kito.", "signin");
  const { data: who } = await sb.auth.getUser();
  if (!who.user) return fail(401, "Sign in to ask Kito.", "signin");

  let body: { question?: string; lang?: string; history?: Turn[] };
  try {
    body = await req.json();
  } catch {
    return fail(400, "Bad request.");
  }
  const lang: Lang = body.lang === "sw" ? "sw" : "en";
  const question = (body.question ?? "").trim().slice(0, 600);
  if (question.length < 3) return fail(400, lang === "sw" ? "Andika swali lako kwanza." : "Type your question first.");
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((t) => t && (t.role === "user" || t.role === "kito") && typeof t.text === "string")
    .slice(-4);

  const flag = safetyFlag(question);
  if (flag === "crisis") return NextResponse.json({ answer: CRISIS_REPLY[lang], sources: [], confident: true, flag });

  const { data: usageId, error: allowErr } = await sb.rpc("kito_allow", { p_lang: lang });
  if (allowErr) {
    if (/could not find the function|schema cache/i.test(allowErr.message)) return fail(503, "Kito isn't set up yet (database update 0013).", "setup");
    return fail(allowErr.code === "42501" ? 403 : 429, allowErr.message, allowErr.hint ?? undefined);
  }
  const done = (status: string, sources: number, inChars: number, outChars: number) =>
    sb.rpc("kito_done", { p_id: usageId, p_status: status, p_sources: sources, p_in: inChars, p_out: outChars });

  // Follow-ups like "and how often?" are searched together with his previous question
  const lastAsked = [...history].reverse().find((t) => t.role === "user")?.text ?? "";
  let hits = [] as ReturnType<typeof search>;
  try {
    const index = buildIndex(await libraryDocs(sb));
    hits = search(index, question, 6);
    if (hits.length < 2 && lastAsked) hits = search(index, `${lastAsked} ${question}`, 6);
  } catch {
    await done("error", 0, question.length, 0);
    return fail(502, lang === "sw" ? "Imeshindikana kufungua maktaba. Jaribu tena." : "Couldn't open the library. Try again.");
  }

  if (!hits.length) {
    await done("not_in_library", 0, question.length, 0);
    const answer = flag === "urgent" ? `${URGENT_LINE[lang]} ${NOT_IN_LIBRARY[lang]}` : NOT_IN_LIBRARY[lang];
    return NextResponse.json({ answer, sources: [], confident: false, flag });
  }
  if (!KEY) {
    await done("error", hits.length, question.length, 0);
    // No AI connected: still useful — show the closest guides
    return NextResponse.json({
      answer: lang === "sw" ? "Hii ndiyo miongozo iliyo karibu zaidi na swali lako:" : "These are the closest guides to your question:",
      sources: hits.slice(0, 3).map((h) => toSource(h.doc, lang)),
      confident: false,
      flag,
    });
  }

  const message = buildKitoMessage(question, hits, lang, history);
  try {
    const res = await fetch(`${BASE}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01",
        ...(WORKSPACE ? { "anthropic-workspace-id": WORKSPACE } : {}),
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 900, system: KITO_SYSTEM, messages: [{ role: "user", content: message }] }),
      signal: AbortSignal.timeout(45_000),
    });
    const json = (await res.json().catch(() => ({}))) as { content?: { type: string; text?: string }[] };
    if (!res.ok) throw new Error(`AI ${res.status}`);
    const text = (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
    const reply = parseKito(text, hits.length);
    const used = reply.used.map((n) => hits[n - 1].doc);
    const answer = flag === "urgent" ? `${URGENT_LINE[lang]}\n\n${reply.answer}` : reply.answer;
    await done(reply.confident ? "answered" : "not_in_library", used.length, message.length, text.length);
    return NextResponse.json({
      answer,
      // The guides it used; when it wasn't sure, the closest ones so he still has somewhere to go
      sources: (used.length ? used : reply.confident ? [] : hits.slice(0, 2).map((h) => h.doc)).map((d) => toSource(d, lang)),
      confident: reply.confident,
      flag,
    });
  } catch {
    await done("error", hits.length, message.length, 0);
    return NextResponse.json({
      answer: lang === "sw" ? "Kito hakuweza kujibu sasa hivi. Hii ndiyo miongozo iliyo karibu na swali lako:" : "Kito couldn't answer right now. These guides are the closest to your question:",
      sources: hits.slice(0, 3).map((h) => toSource(h.doc, lang)),
      confident: false,
      flag,
    });
  }
}

function toSource(d: KitoDoc, lang: Lang): KitoSource {
  return { id: d.id, title: lang === "sw" && d.titleSw ? d.titleSw : d.title, href: d.href, kind: d.kind };
}
