"use client";

// Admin → AI: drafting helpers (through /api/ai, only when connected), plus checks that need no AI:
// topic gaps, content quality, AI drafts, approved sources and usage.

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useStudio } from "@/components/admin/AdminShell";
import { Badge, Empty, ErrorBox, Loading, NotConnected, PageHeader, Panel, Segmented, ago, btn, input, useLoad } from "@/components/admin/ui";
import { useToast } from "@/components/motion/Toast";
import { db, rpc, select } from "@/lib/admin/api";
import { LIBRARY, TOPICS } from "@/lib/content/library";
import { getContentRepo } from "@/lib/content/repo";
import { mergeLibrary } from "@/lib/content/rows";
import { KIND_LABEL, SECTIONS, sectionAll } from "@/lib/content/select";
import type { ContentItem, QuizQuestion, TopicId } from "@/lib/content/types";
import { checkClaims } from "@/lib/studio/claims";
import { blankItem, publishProblems, slugify } from "@/lib/studio/validate";
import { DEFAULT_AI, type AiAction, type AiConfig } from "@/lib/ai/prompts";
import { getSupabase } from "@/lib/supabase/client";

type Status = { configured: boolean; enabled: boolean; model: string | null } | { error: string };
type Source = { id: number; title: string; url: string | null; notes: string | null; approved: boolean };
type Usage = { id: number; action: string; ok: boolean; error: string | null; created_at: string };

async function callAi(method: "GET" | "POST", body?: unknown) {
  const { data } = (await getSupabase()?.auth.getSession()) ?? { data: { session: null } };
  const res = await fetch("/api/ai", {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
  if (!res.ok) throw new Error(json.error ?? `Server error (${res.status})`);
  return json;
}

export default function AiPage() {
  const studio = useStudio();
  const [tab, setTab] = useState<"assist" | "checks" | "sources" | "usage">("assist");
  const status = useLoad<Status>(() => callAi("GET").catch((e: Error) => ({ error: e.message })), []);
  const all = useLoad(() => getContentRepo().listAll(), []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI"
        sub="Help with drafting, translating and checking. AI drafts can be published straight away from the editor."
        actions={
          <Segmented
            label="Section"
            value={tab}
            onChange={setTab}
            options={[
              { id: "assist", label: "Assistant" },
              { id: "checks", label: "Gaps & quality" },
              { id: "sources", label: "Sources" },
              { id: "usage", label: "Usage" },
            ]}
          />
        }
      />

      {status.data && "error" in status.data ? (
        <ErrorBox error={status.data.error} />
      ) : status.data && !status.data.configured ? (
        <NotConnected title="AI isn't connected yet">
          The assistant needs an AI API key on the server: add <code>ANTHROPIC_API_KEY</code> (and optionally <code>AI_MODEL</code>) to the hosting
          environment, then restart. The key is never stored in the app or the database. Gaps, quality checks, sources and AI drafts below work
          without it.
        </NotConnected>
      ) : status.data && !status.data.enabled ? (
        <NotConnected title="AI is switched off">An owner can switch it on in Settings → Features. The key is configured ({status.data.model}).</NotConnected>
      ) : status.data ? (
        <p className="flex items-center gap-2 text-sm text-forest">
          <CheckCircle2 size={16} /> Connected · {status.data.model}
        </p>
      ) : null}

      {tab === "assist" && <Assistant ready={Boolean(status.data && !("error" in status.data) && status.data.configured && status.data.enabled)} items={all.data ?? []} canEdit={studio.can("content.edit")} />}
      {tab === "checks" && <Checks items={all.data} error={all.error} />}
      {tab === "sources" && <Sources canManage={studio.can("content.publish")} />}
      {tab === "usage" && <UsageLog />}
    </div>
  );
}

function Assistant({ ready, items, canEdit }: { ready: boolean; items: ContentItem[]; canEdit: boolean }) {
  const showToast = useToast();
  const [action, setAction] = useState<AiAction>("draft");
  const [topic, setTopic] = useState<TopicId>("wellbeing");
  const [kind, setKind] = useState<"article" | "guide">("article");
  const [brief, setBrief] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [text, setText] = useState("");
  const [to, setTo] = useState<"video" | "expert">("video");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const library = useMemo(() => mergeLibrary(LIBRARY, items.filter((c) => c.status === "published")), [items]);
  const all = useMemo(() => [...items, ...LIBRARY.filter((b) => !items.some((c) => c.id === b.id))], [items]);
  const source = all.find((c) => c.id === sourceId);
  const input_ = source ? [source.title, source.summary, ...(source.body ?? []), ...(source.keyPoints ?? [])].join("\n\n") : text;

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await callAi("POST", { action, topic, kind, brief, text: input_, to });
      setResult(r.result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Save an AI result as a new draft: marked AI-assisted, checklist and claim checks run in the editor. */
  async function saveAsDraft(item: Partial<ContentItem>) {
    const base = blankItem();
    let id = slugify(item.title || "ai-draft");
    const taken = new Set([...LIBRARY, ...items].map((c) => c.id));
    for (let n = 2; taken.has(id); n++) id = slugify(`${item.title} ${n}`);
    try {
      await getContentRepo().save({ ...base, ...item, id, aiGenerated: true, review: "draft", source: "Kayani Herbs" } as ContentItem, "draft");
      showToast("Saved as a draft");
      window.location.href = `/studio/edit?id=${encodeURIComponent(id)}`;
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Panel title="Ask the assistant">
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-ink-soft">
            What to do
            <select value={action} onChange={(e) => (setAction(e.target.value as AiAction), setResult(null))} className={`${input} mt-1 font-normal text-ink`}>
              <option value="draft">Draft a new article or guide</option>
              <option value="summarize">Write a card summary</option>
              <option value="titles">Suggest titles and descriptions</option>
              <option value="quiz">Make quiz questions</option>
              <option value="translate">Translate to Kiswahili</option>
              <option value="repurpose">Turn into video key points or an expert Q&amp;A</option>
            </select>
          </label>
          {action === "draft" ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-ink-soft">
                  Topic
                  <select value={topic} onChange={(e) => setTopic(e.target.value as TopicId)} className={`${input} mt-1 font-normal text-ink`}>
                    {TOPICS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-ink-soft">
                  Type
                  <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={`${input} mt-1 font-normal text-ink`}>
                    <option value="article">Article</option>
                    <option value="guide">Guide</option>
                  </select>
                </label>
              </div>
              <label className="block text-xs font-semibold text-ink-soft">
                Brief
                <textarea value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={600} className={`${input} mt-1 min-h-20 font-normal text-ink`} placeholder="e.g. Why sleep affects energy and desire; 3 simple habits; when to see a doctor" />
              </label>
            </>
          ) : (
            <>
              <label className="block text-xs font-semibold text-ink-soft">
                Start from content
                <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={`${input} mt-1 font-normal text-ink`}>
                  <option value="">— paste text instead —</option>
                  {all.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              {!source && <textarea value={text} onChange={(e) => setText(e.target.value)} className={`${input} min-h-32`} placeholder="Paste the text here" aria-label="Text" />}
              {action === "repurpose" && <Segmented label="Turn into" value={to} onChange={setTo} options={[{ id: "video", label: "Video key points" }, { id: "expert", label: "Expert Q&A" }]} />}
            </>
          )}
          {error && <ErrorBox error={error} />}
          <button className={btn.primary} disabled={!ready || busy || !canEdit} onClick={run}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {busy ? "Working…" : "Ask"}
          </button>
          {!ready && <p className="text-xs text-ink-soft">The assistant is unavailable until AI is connected and switched on (see above).</p>}
        </div>
      </Panel>

      <Panel title="Result" sub="A draft for you to check. Nothing is saved until you choose.">
        {!result ? (
          <p className="text-sm text-ink-soft">The answer appears here.</p>
        ) : (
          <div className="space-y-3 text-sm">
            {typeof result.title === "string" && <p className="text-base font-bold">{result.title}</p>}
            {typeof result.question === "string" && <p className="font-semibold">Q: {result.question}</p>}
            {typeof result.summary === "string" && <p className="text-ink-soft">{result.summary}</p>}
            {Array.isArray(result.body) && (result.body as string[]).map((p, i) => (p.startsWith("## ") ? <p key={i} className="font-bold">{p.slice(3)}</p> : <p key={i}>{p}</p>))}
            {Array.isArray(result.titles) && (
              <ul className="list-disc pl-5">
                {(result.titles as string[]).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
            {Array.isArray(result.descriptions) && (result.descriptions as string[]).map((d) => <p key={d} className="text-ink-soft">{d}</p>)}
            {Array.isArray(result.keyPoints) && (
              <ol className="list-decimal pl-5">
                {(result.keyPoints as string[]).map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ol>
            )}
            {Array.isArray(result.questions) &&
              (result.questions as QuizQuestion[]).map((q, i) => (
                <div key={i} className="rounded-xl bg-bg p-3">
                  <p className="font-semibold">{q.q}</p>
                  <ul className="mt-1 text-xs">
                    {q.options.map((o, j) => (
                      <li key={j} className={j === q.answer ? "font-semibold text-forest" : ""}>
                        {j === q.answer ? "✓ " : "· "}
                        {o}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-ink-soft">{q.explain}</p>
                </div>
              ))}
            {canEdit && (
              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                {action === "draft" && (
                  <button className={btn.primary} onClick={() => saveAsDraft({ kind, topic, title: String(result.title), summary: String(result.summary), body: result.body as string[] })}>
                    Save as draft
                  </button>
                )}
                {action === "quiz" && (
                  <button className={btn.primary} onClick={() => saveAsDraft({ kind: "quiz", topic: source?.topic ?? topic, title: `Quiz: ${source?.title ?? "check your knowledge"}`, summary: "Check what you know in four quick questions.", quiz: result.questions as QuizQuestion[] })}>
                    Save as a quiz draft
                  </button>
                )}
                {action === "repurpose" && to === "expert" && (
                  <button className={btn.primary} onClick={() => saveAsDraft({ kind: "expert", topic: source?.topic ?? topic, title: String(result.question).slice(0, 150), summary: String((result.body as string[])?.[0] ?? "").slice(0, 200), question: String(result.question), body: result.body as string[] })}>
                    Save as an expert answer draft
                  </button>
                )}
                {action === "repurpose" && to === "video" && (
                  <button className={btn.primary} onClick={() => saveAsDraft({ kind: "video", topic: source?.topic ?? topic, title: `${source?.title ?? "Video"} (video)`, summary: source?.summary ?? "", keyPoints: result.keyPoints as string[], minutes: 2 })}>
                    Save as a video draft
                  </button>
                )}
                {action === "translate" && source && (
                  <button
                    className={btn.primary}
                    onClick={() => {
                      // Opens the item with the Kiswahili filled in (not saved yet), so you check it before saving
                      try {
                        sessionStorage.setItem(`ms_ai_sw:${source.id}`, JSON.stringify({ titleSw: result.title, summarySw: result.summary, bodySw: result.body }));
                      } catch {}
                      window.location.href = `/studio/edit?id=${encodeURIComponent(source.id)}`;
                    }}
                  >
                    Add as the Kiswahili version
                  </button>
                )}
                <button className={btn.ghost} onClick={() => void navigator.clipboard.writeText(JSON.stringify(result, null, 2)).then(() => showToast("Copied"))}>
                  Copy
                </button>
              </div>
            )}
          </div>
        )}
        <p className="mt-3 text-[0.6875rem] text-ink-soft">{library.length} live items available as context.</p>
      </Panel>
    </div>
  );
}

/** No AI needed: where content is thin, what men search for without results, and quality problems. */
function Checks({ items, error }: { items: ContentItem[] | null; error: string | null }) {
  const searches = useLoad(
    () =>
      select<{ term: string; searches: number; no_results: number }>("search_stats_daily", "term,searches,no_results", (q) => q.gte("day", new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10))).then((rows) => {
        const m = new Map<string, { searches: number; none: number }>();
        for (const r of rows) {
          const x = m.get(r.term) ?? { searches: 0, none: 0 };
          x.searches += r.searches;
          x.none += r.no_results;
          m.set(r.term, x);
        }
        return [...m].filter(([, v]) => v.none > 0).sort((a, b) => b[1].none - a[1].none).slice(0, 12);
      }),
    [],
  );
  if (error) return <ErrorBox error={error} />;
  if (!items) return <Loading />;
  const live = mergeLibrary(LIBRARY, items.filter((c) => c.status === "published"));
  const queue = items.filter((c) => c.aiGenerated && c.status !== "published");
  const quality = items
    .map((c) => ({
      c,
      issues: [
        ...publishProblems(c),
        ...checkClaims(c).filter((x) => x.level === "block").map((x) => `Claim: “${x.match}” — ${x.message}`),
        ...(!c.titleSw ? ["No Kiswahili title"] : []),
      ],
    }))
    .filter((x) => x.issues.length);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Topic gaps" sub="Live items per topic and format. Thin topics are where new content helps most.">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {SECTIONS.map((s) => {
                const n = sectionAll(s.id, live).length;
                return (
                  <tr key={s.id}>
                    <td className="py-1.5">{s.title}</td>
                    <td className="py-1.5 text-right tabular-nums">{n}</td>
                    <td className="w-28 py-1.5 pl-3">{n < 3 ? <Badge tone="warn">Needs content</Badge> : n < 5 ? <Badge>Thin</Badge> : <Badge tone="good">OK</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
        <Panel title="Searches that found nothing" sub="Last 30 days. Men looked for these and got no results.">
          {searches.error ? (
            <p className="text-sm text-ink-soft">{searches.error}</p>
          ) : !searches.data ? (
            <p className="text-sm text-ink-soft">Loading…</p>
          ) : searches.data.length === 0 ? (
            <p className="text-sm text-ink-soft">None yet (searches are counted from the updated app onwards).</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {searches.data.map(([term, v]) => (
                <li key={term} className="flex justify-between">
                  <span>&ldquo;{term}&rdquo;</span>
                  <span className="text-ink-soft">{v.none} with no results</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Panel title="AI drafts" sub="Drafts made with AI help that aren't published yet.">
        {queue.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing waiting.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {queue.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                <Link href={`/studio/edit?id=${encodeURIComponent(c.id)}`} className="truncate font-medium hover:underline">
                  {c.title}
                </Link>
                <Badge tone={c.status === "review" ? "warn" : "neutral"}>{c.status === "review" ? "In review" : "Draft"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Quality checks" sub="Your Studio items with something to fix (missing parts, risky claims, no Kiswahili).">
        {quality.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-forest">
            <CheckCircle2 size={16} /> All your items pass.
          </p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {quality.map(({ c, issues }) => (
              <li key={c.id} className="py-2">
                <Link href={`/studio/edit?id=${encodeURIComponent(c.id)}`} className="font-medium hover:underline">
                  {c.title}
                </Link>
                <span className="ml-2 text-xs text-ink-soft">{KIND_LABEL[c.kind]}</span>
                <ul className="mt-1 list-disc pl-5 text-xs text-ink-soft">
                  {issues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Sources({ canManage }: { canManage: boolean }) {
  const showToast = useToast();
  const list = useLoad(() => select<Source>("ai_sources", "id,title,url,notes,approved", (q) => q.order("created_at", { ascending: false })), []);
  const settings = useLoad(() => select<{ value: AiConfig }>("app_settings", "value", (q) => q.eq("key", "ai_config")).then((r) => ({ ...DEFAULT_AI, ...(r[0]?.value ?? {}) })), []);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [tone, setTone] = useState<string | null>(null);
  const [rules, setRules] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    const { error } = await db().from("ai_sources").insert({ title: title.trim(), url: url.trim() || null });
    if (error) return setError(/check constraint/.test(error.message) ? "Use a title of at least 3 letters and an https:// link." : error.message);
    setTitle("");
    setUrl("");
    list.reload();
  }
  async function remove(id: number) {
    const { error } = await db().from("ai_sources").delete().eq("id", id);
    if (error) return setError(error.message);
    list.reload();
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Panel title="Approved knowledge sources" sub="The AI is told to rely on these. Add trusted references (e.g. WHO, NHS, Tanzania Ministry of Health pages).">
        {canManage && (
          <div className="mb-3 space-y-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name, e.g. WHO — Physical activity fact sheet" className={input} aria-label="Source name" />
            <div className="flex gap-2">
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (optional)" className={input} aria-label="Source link" />
              <button className={btn.primary} disabled={title.trim().length < 3} onClick={add}>
                <Plus size={14} /> Add
              </button>
            </div>
          </div>
        )}
        {error && <ErrorBox error={error} />}
        {list.error ? (
          <ErrorBox error={list.error} />
        ) : !list.data ? (
          <Loading />
        ) : list.data.length === 0 ? (
          <Empty title="No sources yet" />
        ) : (
          <ul className="divide-y divide-line text-sm">
            {list.data.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="block font-medium">{s.title}</span>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-forest underline">
                      {s.url}
                    </a>
                  )}
                </span>
                {canManage && (
                  <button aria-label={`Remove ${s.title}`} onClick={() => remove(s.id)} className="text-ink-soft">
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="How the AI writes" sub="Added to every request, on top of the fixed safety rules (no diagnosis, no dosing, no promises, see a professional).">
        {!settings.data ? (
          <Loading />
        ) : (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-ink-soft">
              Tone
              <input value={tone ?? settings.data.tone} onChange={(e) => setTone(e.target.value)} maxLength={200} className={`${input} mt-1 font-normal text-ink`} />
            </label>
            <label className="block text-xs font-semibold text-ink-soft">
              Extra rules
              <textarea value={rules ?? settings.data.rules} onChange={(e) => setRules(e.target.value)} maxLength={1000} className={`${input} mt-1 min-h-24 font-normal text-ink`} placeholder="e.g. Use Tanzanian examples. Avoid the word 'patient'." />
            </label>
            <button
              className={btn.primary}
              onClick={async () => {
                try {
                  await rpc("settings_set", { p_key: "ai_config", p_value: { ...settings.data, tone: tone ?? settings.data!.tone, rules: rules ?? settings.data!.rules } });
                  showToast("AI settings saved");
                  settings.reload();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Save
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}

function UsageLog() {
  const list = useLoad(() => select<Usage>("ai_usage", "id,action,ok,error,created_at", (q) => q.order("created_at", { ascending: false }).limit(50)), []);
  if (list.error) return <ErrorBox error={list.error} />;
  if (!list.data) return <Loading />;
  const failed = list.data.filter((u) => !u.ok).length;
  return (
    <Panel title="Recent AI requests" sub={`${list.data.length} shown · ${failed} failed`}>
      {list.data.length === 0 ? (
        <Empty title="No AI requests yet" />
      ) : (
        <ul className="divide-y divide-line text-sm">
          {list.data.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-2 py-2">
              <span>
                {u.action} {u.ok ? <Badge tone="good">OK</Badge> : <Badge tone="bad">Failed</Badge>}
                {u.error && <span className="ml-2 text-xs text-ink-soft">{u.error}</span>}
              </span>
              <span className="text-xs text-ink-soft">{ago(u.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
