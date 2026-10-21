"use client";

// Admin → Card maker. Send anything (text, a PDF, a photo, a link, an audio or video with notes) and the
// AI turns it into one "do this" card in the Discover format: photo, hook, what you need, steps, the secret.
// Staff check it in a real phone preview, fix any words, then publish. Men see it at the top of Discover.

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileUp, Link2, Loader2, Plus, Sparkles, Trash2, Type } from "lucide-react";
import { useStudio } from "@/components/admin/AdminShell";
import { Badge, ErrorBox, PageHeader, Panel, Segmented, btn, input } from "@/components/admin/ui";
import { useToast } from "@/components/motion/Toast";
import { ActionPost } from "@/components/social/ActionFeed";
import { LangOverride } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase/client";
import { getContentRepo } from "@/lib/content/repo";
import { ACTION_RESULTS, ACTION_TYPES, CHALLENGE_IDS } from "@/lib/content/action-shape";
import { CARD_PHOTOS, photoUrl, type CardPhoto } from "@/lib/content/card-photos";
import { newCardId, studioCardToItem, type StudioCard } from "@/lib/content/studio-card";
import { checkClaims } from "@/lib/studio/claims";
import type { CardDraft } from "@/lib/ai/card";
import type { ActionResult, ActionSlide, ActionType, ChallengeId } from "@/lib/content/types";

type Mode = "text" | "file" | "link";
type FileKind = "pdf" | "image" | "audio" | "video" | "textfile";

const MAX_SEND = 4 * 1024 * 1024;
const CHALLENGE_NAME: Record<ChallengeId, string> = {
  last: "Last longer",
  hard: "Stronger erections",
  her: "Satisfy her",
  mixes: "Natural mixes",
  train: "Exercises",
  reset: "Quit porn / confidence",
  desire: "Desire and round two",
};
const RESULT_NAME: Record<ActionResult, string> = { tonight: "Works tonight", days: "Results in days", weeks2: "1–3 weeks", weeks4: "3–6 weeks", daily: "Daily habit" };

function kindOf(f: File): FileKind | null {
  if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) return "pdf";
  if (/^image\/(jpeg|png|webp)$/.test(f.type)) return "image";
  if (f.type.startsWith("audio/")) return "audio";
  if (f.type.startsWith("video/")) return "video";
  if (f.type.startsWith("text/") || /\.(txt|md)$/i.test(f.name)) return "textfile";
  return null;
}

const toBase64 = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Couldn't read the file."));
    r.readAsDataURL(f);
  });

async function askAi(body: Record<string, unknown>): Promise<CardDraft> {
  const { data } = (await getSupabase()?.auth.getSession()) ?? { data: { session: null } };
  const res = await fetch("/api/ai/card", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ error: res.status === 413 ? "That file is too big. Keep it under 4 MB." : `Server error (${res.status})` }));
  if (!res.ok) throw new Error(json.error ?? `Server error (${res.status})`);
  return json.card as CardDraft;
}

export default function CardMakerPage() {
  const studio = useStudio();
  const showToast = useToast();
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [useAsPhoto, setUseAsPhoto] = useState(true);
  const [busy, setBusy] = useState<"make" | "save" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<StudioCard | null>(null);
  const [lang, setLang] = useState<"en" | "sw">("sw");
  const [published, setPublished] = useState<string | null>(null);
  const fk = file ? kindOf(file) : null;
  const canPublish = studio.can("content.publish");
  const repo = getContentRepo();

  async function make() {
    setError(null);
    setPublished(null);
    setBusy("make");
    try {
      let body: Record<string, unknown>;
      let media: { videoUrl?: string; audioUrl?: string } = {};
      const id = card?.id ?? newCardId("draft");
      if (mode === "text") body = { kind: "text", text, notes };
      else if (mode === "link") body = { kind: "link", url, notes };
      else {
        if (!file || !fk) throw new Error("Choose a PDF, photo, audio, video or text file.");
        if (fk === "textfile") body = { kind: "text", text: await file.text(), notes };
        else if (fk === "audio" || fk === "video") {
          if (notes.trim().length < 20) throw new Error(`The AI can't listen to ${fk} yet. Write what it says (or paste a transcript) in the notes box.`);
          const link = fk === "audio" ? await repo.uploadAudio(file, id) : await repo.uploadVideo(file, id);
          media = fk === "audio" ? { audioUrl: link } : { videoUrl: link };
          body = { kind: fk, name: file.name, notes };
        } else {
          if (file.size > MAX_SEND) throw new Error("Keep PDFs and photos under 4 MB.");
          body = { kind: fk, base64: await toBase64(file), mediaType: file.type, name: file.name, notes };
        }
      }
      const d = await askAi(body);
      let imageUrl: string | undefined;
      if (mode === "file" && fk === "image" && useAsPhoto && file) imageUrl = await repo.uploadImage(file, id).catch(() => undefined);
      setCard({
        id: newCardId(d.title),
        title: d.title,
        titleSw: d.titleSw,
        summary: d.summary,
        summarySw: d.summarySw,
        minutes: d.minutes,
        action: d.action,
        photo: d.photo,
        imageUrl,
        ...media,
        sourceNote: mode === "link" ? `From ${url}` : mode === "file" && file ? `From file ${file.name}` : "From pasted text",
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const item = useMemo(() => (card ? studioCardToItem(card) : null), [card]);
  const blocks = useMemo(() => (item ? checkClaims(item).filter((i) => i.level === "block") : []), [item]);

  async function save(publish: boolean) {
    if (!item) return;
    setError(null);
    setBusy(publish ? "publish" : "save");
    try {
      // Publishing: goes live straight away (Step 66b: no professional-check gate)
      await repo.save({ ...item, review: publish ? "reviewed" : "draft" }, publish ? "published" : "draft");
      setPublished(publish ? "published" : "draft");
      showToast(publish ? "Published · men see it at the top of Discover" : "Saved as a draft in Content");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const set = (patch: Partial<StudioCard>) => setCard((c) => (c ? { ...c, ...patch } : c));
  const setAction = (patch: Partial<StudioCard["action"]>) => setCard((c) => (c ? { ...c, action: { ...c.action, ...patch } } : c));
  const setStep = (i: number, patch: Partial<ActionSlide>) =>
    setCard((c) => (c ? { ...c, action: { ...c.action, steps: c.action.steps.map((s, k) => (k === i ? { ...s, ...patch } : s)) } } : c));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Card maker"
        sub="Send anything: text, a PDF, a photo, a link, or an audio or video with notes. The AI turns it into one “do this” card in the Discover format. Check it in the phone preview, fix any words, then publish."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <Panel title="1 · What are you sending?">
            <Segmented
              label="Source"
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError(null);
              }}
              options={[
                { id: "text", label: "Text" },
                { id: "file", label: "File" },
                { id: "link", label: "Link" },
              ]}
            />
            <div className="mt-4 space-y-3">
              {mode === "text" && (
                <label className="block text-sm">
                  <span className="mb-1 flex items-center gap-1.5 font-semibold"><Type size={14} /> Paste the text</span>
                  <textarea className={`${input} min-h-[180px]`} value={text} onChange={(e) => setText(e.target.value)} placeholder="An Instagram caption, a WhatsApp message, notes from a lesson, a recipe…" />
                </label>
              )}
              {mode === "link" && (
                <label className="block text-sm">
                  <span className="mb-1 flex items-center gap-1.5 font-semibold"><Link2 size={14} /> Link to a web page</span>
                  <input className={input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" inputMode="url" />
                  <span className="mt-1 block text-xs text-ink-soft">Instagram, Facebook and TikTok hide posts from other servers: for those, paste the caption as Text or upload the photo.</span>
                </label>
              )}
              {mode === "file" && (
                <div className="text-sm">
                  <span className="mb-1 flex items-center gap-1.5 font-semibold"><FileUp size={14} /> Upload a file</span>
                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp,audio/*,video/*,.txt,.md"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setFile(f);
                      setError(f && !kindOf(f) ? (/\.docx?$/i.test(f.name) ? "Word files: save it as PDF first (File → Save as → PDF), then upload the PDF." : "Use a PDF, photo (JPG, PNG, WebP), audio, video or .txt file.") : null);
                    }}
                    className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-forest file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                  />
                  {file && fk && (
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                      <Badge tone="info">{fk === "textfile" ? "Text file" : fk.toUpperCase()}</Badge>
                      {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
                      {(fk === "pdf" || fk === "image") && file.size > MAX_SEND && <Badge tone="bad">Too big: keep it under 4 MB</Badge>}
                    </p>
                  )}
                  {fk === "image" && (
                    <label className="mt-2 flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={useAsPhoto} onChange={(e) => setUseAsPhoto(e.target.checked)} /> Use this photo as the card&apos;s background
                    </label>
                  )}
                  {(fk === "audio" || fk === "video") && (
                    <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                      The AI can&apos;t listen to {fk} yet. The file will play on the card; write what it says (or paste a transcript) in the notes below so the AI can write the steps.
                    </p>
                  )}
                </div>
              )}
              <label className="block text-sm">
                <span className="mb-1 block font-semibold">Notes for the AI {fk === "audio" || fk === "video" ? "(needed)" : "(optional)"}</span>
                <textarea
                  className={`${input} min-h-[80px]`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={fk === "audio" || fk === "video" ? "What does the audio/video teach? Write the steps or paste the transcript." : "E.g. make it about lasting longer · use only the second recipe · for married men"}
                />
              </label>
              <button className={btn.primary} disabled={busy !== null || (mode === "text" && text.trim().length < 20) || (mode === "link" && !url.trim()) || (mode === "file" && !fk)} onClick={make}>
                {busy === "make" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {card ? "Make it again" : "Make the card"}
              </button>
            </div>
          </Panel>

          {error && <ErrorBox error={error} />}

          {card && (
            <Panel title="2 · Check the words" sub="Fix anything that isn't right. The preview updates as you type.">
              <div className="space-y-4">
                <Pair label="Title" en={card.title} sw={card.titleSw} onChange={(title, titleSw) => set({ title, titleSw })} />
                <Pair label="Opening line" en={card.summary} sw={card.summarySw} onChange={(summary, summarySw) => set({ summary, summarySw })} long />
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-sm">
                    <span className="mb-1 block font-semibold">Kind</span>
                    <select className={input} value={card.action.type} onChange={(e) => setAction({ type: e.target.value as ActionType })}>
                      {ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-semibold">When he feels it</span>
                    <select className={input} value={card.action.results} onChange={(e) => setAction({ results: e.target.value as ActionResult })}>
                      {ACTION_RESULTS.map((r) => <option key={r} value={r}>{RESULT_NAME[r]}</option>)}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-semibold">Minutes</span>
                    <input type="number" min={1} max={30} className={input} value={card.minutes} onChange={(e) => set({ minutes: Math.min(30, Math.max(1, Number(e.target.value) || 1)) })} />
                  </label>
                </div>
                <fieldset className="text-sm">
                  <legend className="mb-1 font-semibold">Challenges (circles at the top of Discover)</legend>
                  <div className="flex flex-wrap gap-2">
                    {CHALLENGE_IDS.map((c) => {
                      const on = card.action.challenges.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            const next = on ? card.action.challenges.filter((x) => x !== c) : [...card.action.challenges, c];
                            if (next.length) setAction({ challenges: next });
                          }}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${on ? "bg-forest text-white ring-forest" : "ring-line"}`}
                        >
                          {CHALLENGE_NAME[c]}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {(card.action.need?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">You need</p>
                    {card.action.need!.map((n, i) => (
                      <Pair
                        key={i}
                        en={n}
                        sw={card.action.needSw?.[i] ?? n}
                        onChange={(en, sw) =>
                          setAction({ need: card.action.need!.map((x, k) => (k === i ? en : x)), needSw: (card.action.needSw ?? card.action.need!).map((x, k) => (k === i ? sw : x)) })
                        }
                      />
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-sm font-semibold">Steps</p>
                  {card.action.steps.map((s, i) => (
                    <div key={i} className="rounded-2xl p-3 ring-1 ring-line">
                      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink-soft">
                        Step {i + 1}
                        {card.action.steps.length > 1 && (
                          <button className={btn.small} onClick={() => setAction({ steps: card.action.steps.filter((_, k) => k !== i) })}>
                            <Trash2 size={12} /> Remove
                          </button>
                        )}
                      </div>
                      {(s.title || s.titleSw) && <Pair label="Step title" en={s.title ?? ""} sw={s.titleSw ?? ""} onChange={(title, titleSw) => setStep(i, { title, titleSw })} />}
                      <Pair en={s.text} sw={s.textSw} onChange={(text, textSw) => setStep(i, { text, textSw })} long />
                    </div>
                  ))}
                  {card.action.steps.length < 12 && (
                    <button className={btn.small} onClick={() => setAction({ steps: [...card.action.steps, { text: "New step", textSw: "Hatua mpya" }] })}>
                      <Plus size={12} /> Add a step
                    </button>
                  )}
                </div>
                <Pair
                  label="The secret (why it works)"
                  en={card.action.why ?? ""}
                  sw={card.action.whySw ?? ""}
                  onChange={(why, whySw) => setAction(why || whySw ? { why, whySw } : { why: undefined, whySw: undefined })}
                  long
                />

                <div>
                  <p className="mb-2 text-sm font-semibold">Background photo</p>
                  <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
                    {card.imageUrl && (
                      <button onClick={() => set({ photo: null })} className={`overflow-hidden rounded-xl ring-2 ${card.photo === null ? "ring-forest" : "ring-transparent"}`} title="Your uploaded photo">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={card.imageUrl} alt="Uploaded" className="aspect-square w-full object-cover" />
                      </button>
                    )}
                    {CARD_PHOTOS.map((p: CardPhoto) => (
                      <button
                        key={p}
                        onClick={() => set({ photo: p, imageUrl: card.photo === null ? undefined : card.imageUrl })}
                        className={`overflow-hidden rounded-xl ring-2 ${card.photo === p && !(card.imageUrl && card.photo === null) ? "ring-forest" : "ring-transparent"}`}
                        title={p}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photoUrl(p)} alt={p} loading="lazy" className="aspect-square w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
          )}
        </div>

        {/* Phone preview and publish */}
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          {item ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">How men will see it</p>
                <Segmented label="Preview language" value={lang} onChange={setLang} options={[{ id: "sw", label: "Kiswahili" }, { id: "en", label: "English" }]} />
              </div>
              <div className="mx-auto max-w-[390px] rounded-[32px] bg-bg p-3 ring-1 ring-line">
                <LangOverride lang={lang}>
                  <ActionPost card={{ item: { ...item, coverImageUrl: card!.photo === null && card!.imageUrl ? card!.imageUrl : card!.photo ? photoUrl(card!.photo) : item.coverImageUrl }, spec: item.action! }} first done={false} liked={false} saved={false} />
                </LangOverride>
              </div>
              {blocks.length > 0 && (
                <ErrorBox error={`Fix before publishing: ${blocks.map((b) => b.message).join(" · ")}`} />
              )}
              <div className="flex flex-wrap gap-2">
                <button className={btn.ghost} disabled={busy !== null} onClick={() => save(false)}>
                  {busy === "save" && <Loader2 size={15} className="animate-spin" />} Save as draft
                </button>
                {canPublish ? (
                  <button className={btn.primary} disabled={busy !== null || blocks.length > 0} onClick={() => save(true)}>
                    {busy === "publish" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Publish
                  </button>
                ) : (
                  <p className="text-xs text-ink-soft">Your role can save drafts. An editor or owner publishes them from Content.</p>
                )}
              </div>
              {published && (
                <p className="text-sm text-forest">
                  {published === "published" ? "Live. It's at the top of Discover now." : "Saved. Find it in "}
                  {published !== "published" && <Link href="/studio/content" className="font-semibold underline">Content</Link>}
                </p>
              )}
            </>
          ) : (
            <div className="rounded-3xl p-6 text-sm text-ink-soft ring-1 ring-dashed ring-line">
              The phone preview shows here after the AI makes the card.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Pair({ label, en, sw, onChange, long = false }: { label?: string; en: string; sw: string; onChange: (en: string, sw: string) => void; long?: boolean }) {
  const Field = long ? "textarea" : "input";
  return (
    <div className="text-sm">
      {label && <p className="mb-1 font-semibold">{label}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <Field className={`${input} ${long ? "min-h-[64px]" : ""}`} value={en} onChange={(e) => onChange(e.target.value, sw)} aria-label={`${label ?? "Text"} (English)`} placeholder="English" />
        <Field className={`${input} ${long ? "min-h-[64px]" : ""}`} value={sw} onChange={(e) => onChange(en, e.target.value)} aria-label={`${label ?? "Text"} (Kiswahili)`} placeholder="Kiswahili" lang="sw" />
      </div>
    </div>
  );
}
