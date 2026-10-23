"use client";

// Studio → Stories (Step 86): real men's stories for Discover. Only from messages a man sent from Me → Tell us
// AND ticked "you may share it with other men, without my name". Staff write it up (both languages), take out
// anything that could identify him, and publish. The database refuses a story linked to a message he didn't
// agree to share. Men see published stories between the cards (Studio → Discover sets how often).

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Plus, Quote, Trash2 } from "lucide-react";
import { useStudio } from "@/components/admin/AdminShell";
import { Badge, Confirm, Empty, ErrorBox, Loading, PageHeader, Panel, btn, fmtDate, input, useLoad } from "@/components/admin/ui";
import { useToast } from "@/components/motion/Toast";
import { rpc, select } from "@/lib/admin/api";
import { CIRCLES } from "@/lib/content/circles";

type Row = { id: string; text_en: string | null; text_sw: string | null; who_en: string | null; who_sw: string | null; circle: string | null; status: "draft" | "published"; feedback_id: string | null; published_at: string | null; updated_at: string };
type Msg = { id: string; created_at: string; message: string; rating: number | null; lang: string | null; share_ok: boolean };
type Draft = { id: string | null; text_en: string; text_sw: string; who_en: string; who_sw: string; circle: string; feedback_id: string | null; status: "draft" | "published" };

const blank = (): Draft => ({ id: null, text_en: "", text_sw: "", who_en: "A man in the app", who_sw: "Mwanaume kwenye app", circle: "", feedback_id: null, status: "draft" });
const NEEDS = "Run supabase/migrations/0019_discover_hooks.sql in Supabase (SQL Editor) first.";

function StoriesInner() {
  const studio = useStudio();
  const showToast = useToast();
  const params = useSearchParams();
  const canPublish = studio.can("content.publish");
  const canSeeMessages = studio.can("users.view");
  const stories = useLoad(
    () => select<Row>("men_stories", "id,text_en,text_sw,who_en,who_sw,circle,status,feedback_id,published_at,updated_at", (q) => q.order("updated_at", { ascending: false }).limit(200)),
    [],
  );
  const msgs = useLoad(() => (canSeeMessages ? rpc<Msg[]>("feedback_list", { p_status: "stories", p_limit: 200 }) : Promise.resolve([] as Msg[])), [canSeeMessages]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [del, setDel] = useState<Row | null>(null);

  const used = useMemo(() => new Set((stories.data ?? []).map((s) => s.feedback_id).filter(Boolean)), [stories.data]);
  const fromMsg = (m: Msg): Draft => ({ ...blank(), [m.lang === "en" ? "text_en" : "text_sw"]: m.message, feedback_id: m.id });

  // Opened from Feedback → "Make a story"
  const from = params.get("from");
  useEffect(() => {
    if (!from || draft || !msgs.data) return;
    const m = msgs.data.find((x) => x.id === from);
    if (m) setDraft(fromMsg(m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, msgs.data]);

  async function save(status: "draft" | "published") {
    if (!draft) return;
    setBusy(true);
    setErr(null);
    try {
      await rpc("story_save", {
        p_id: draft.id,
        p_text_en: draft.text_en,
        p_text_sw: draft.text_sw,
        p_who_en: draft.who_en,
        p_who_sw: draft.who_sw,
        p_circle: draft.circle || null,
        p_status: status,
        p_feedback_id: draft.feedback_id,
      });
      showToast(status === "published" ? "Published · men see it on Discover" : "Saved as a draft");
      setDraft(null);
      stories.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(r: Row) {
    setBusy(true);
    try {
      await rpc("story_delete", { p_id: r.id });
      showToast("Story deleted");
      setDel(null);
      stories.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const missing = stories.error && /men_stories|does not exist|schema cache/i.test(stories.error);
  const open = (msgs.data ?? []).filter((m) => !used.has(m.id));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stories"
        sub="Real men's stories between the cards on Discover. Only from messages a man agreed to share, with his name and anything that could identify him taken out."
        actions={
          <button className={btn.ghost} onClick={() => setDraft(blank())}>
            <Plus size={15} /> Write a story
          </button>
        }
      />
      {missing && <ErrorBox error={NEEDS} />}
      {err && <ErrorBox error={err} />}

      {draft && (
        <Panel title={draft.id ? "Edit story" : "New story"} sub={draft.feedback_id ? "From a message he agreed to share." : "Write only what a real man told you, with his permission."}>
          <div className="space-y-3 text-sm">
            <p className="rounded-xl bg-honey/20 px-3 py-2 text-xs">
              Take out his name, his partner&apos;s name, his town if it&apos;s small, his work, and anything else that could point to him. Keep his words; fix
              only spelling. No promises of cures.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-soft">His story (English)</span>
                <textarea className={`${input} min-h-[110px]`} value={draft.text_en} onChange={(e) => setDraft({ ...draft, text_en: e.target.value })} maxLength={1200} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-soft">His story (Kiswahili)</span>
                <textarea lang="sw" className={`${input} min-h-[110px]`} value={draft.text_sw} onChange={(e) => setDraft({ ...draft, text_sw: e.target.value })} maxLength={1200} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-soft">Who (English, no name)</span>
                <input className={input} value={draft.who_en} onChange={(e) => setDraft({ ...draft, who_en: e.target.value })} maxLength={80} placeholder="A man, 34, Dar es Salaam" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-soft">Who (Kiswahili, no name)</span>
                <input lang="sw" className={input} value={draft.who_sw} onChange={(e) => setDraft({ ...draft, who_sw: e.target.value })} maxLength={80} placeholder="Mwanaume, 34, Dar es Salaam" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-soft">Circle (men in this circle see it first, with a button to its cards)</span>
              <select className={input} value={draft.circle} onChange={(e) => setDraft({ ...draft, circle: e.target.value })}>
                <option value="">None</option>
                {CIRCLES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button className={btn.ghost} disabled={busy} onClick={() => save("draft")}>
                {busy && <Loader2 size={15} className="animate-spin" />} Save as draft
              </button>
              {canPublish && (
                <button className={btn.primary} disabled={busy || (draft.text_en + draft.text_sw).trim().length < 10} onClick={() => save("published")}>
                  Publish
                </button>
              )}
              <button className={btn.ghost} onClick={() => setDraft(null)}>
                Cancel
              </button>
            </div>
          </div>
        </Panel>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Stories" sub="Published ones show on Discover.">
          {stories.loading ? (
            <Loading />
          ) : !stories.data?.length ? (
            <Empty title="No stories yet">Make one from a message below, or write one a man told you (with his permission).</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {stories.data.map((r) => (
                <li key={r.id} className="py-3 text-sm">
                  <div className="flex items-center gap-2 text-xs text-ink-soft">
                    <Badge tone={r.status === "published" ? "good" : "neutral"}>{r.status === "published" ? "Live" : "Draft"}</Badge>
                    {r.circle && <span>{CIRCLES.find((c) => c.id === r.circle)?.label}</span>}
                    <span>· {fmtDate(r.published_at ?? r.updated_at)}</span>
                  </div>
                  <p className="mt-1 line-clamp-3">
                    <Quote size={12} className="mr-1 inline text-ink-soft" />
                    {r.text_sw || r.text_en}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft">{r.who_sw || r.who_en}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      className={btn.small}
                      onClick={() =>
                        setDraft({ id: r.id, text_en: r.text_en ?? "", text_sw: r.text_sw ?? "", who_en: r.who_en ?? "", who_sw: r.who_sw ?? "", circle: r.circle ?? "", feedback_id: r.feedback_id, status: r.status })
                      }
                    >
                      Edit
                    </button>
                    {r.status === "published" && canPublish && (
                      <button
                        className={btn.small}
                        onClick={async () => {
                          try {
                            await rpc("story_save", { p_id: r.id, p_text_en: r.text_en, p_text_sw: r.text_sw, p_who_en: r.who_en, p_who_sw: r.who_sw, p_circle: r.circle, p_status: "draft", p_feedback_id: r.feedback_id });
                            stories.reload();
                          } catch (e) {
                            setErr((e as Error).message);
                          }
                        }}
                      >
                        Take off Discover
                      </button>
                    )}
                    <button className={btn.small} onClick={() => setDel(r)}>
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {canSeeMessages && (
          <Panel title="Messages men agreed to share" sub="From Me → Tell us, where he ticked “you may share it, without my name”.">
            {msgs.loading ? (
              <Loading />
            ) : msgs.error ? (
              <ErrorBox error={/feedback_list|share_ok|does not exist/i.test(msgs.error) ? NEEDS : msgs.error} />
            ) : open.length === 0 ? (
              <Empty title="Nothing waiting">When a man shares what worked for him and ticks the box, it shows here.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {open.map((m) => (
                  <li key={m.id} className="py-3 text-sm">
                    <p className="text-xs text-ink-soft">
                      {fmtDate(m.created_at, true)} · {m.lang === "en" ? "English" : "Kiswahili"}
                      {m.rating ? ` · ${m.rating}★` : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{m.message}</p>
                    <button className={`${btn.small} mt-2`} onClick={() => setDraft(fromMsg(m))}>
                      <Quote size={12} /> Make a story
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>

      <Confirm open={Boolean(del)} title="Delete this story?" confirmLabel="Delete" busy={busy} onClose={() => setDel(null)} onConfirm={() => del && remove(del)}>
        It goes off Discover for everyone and can&apos;t be brought back.
      </Confirm>
    </div>
  );
}

export default function StoriesPage() {
  return (
    <Suspense>
      <StoriesInner />
    </Suspense>
  );
}
