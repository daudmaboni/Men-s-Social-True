"use client";

// Admin → Card maker. Send anything (text, a PDF, a photo, a link, an audio or video with notes) and the
// AI turns it into one "do this" card in the Discover format: photo, hook, what you need, steps, the secret.
// Staff check it in a real phone preview, fix any words, then publish. Men see it at the top of Discover.

import { listen, stills } from "@/lib/studio/listen";
import { CIRCLE_LABEL } from "@/lib/content/circles";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, FileUp, ImagePlus, Link2, Loader2, Mic, Plus, Sparkles, Trash2, Type } from "lucide-react";
import { shrinkPhoto } from "@/lib/media/shrinkPhoto";
import HookFields from "@/components/studio/HookFields";
import { useDiscoverConfig } from "@/lib/social/discoverPrefs";
import { dropTimes } from "@/lib/content/hooks";
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
// The same names men see on Discover (Step 80)
const CHALLENGE_NAME: Record<ChallengeId, string> = CIRCLE_LABEL;
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
  // Step 85: listening to voice notes and reels, in this browser
  const [hearLang, setHearLang] = useState<"sw" | "en" | null>("sw");
  const [hearing, setHearing] = useState<string | null>(null);

  async function hear() {
    if (!file) return;
    setError(null);
    setHearing("Getting ready…");
    try {
      const text = await listen(file, hearLang, (p) =>
        setHearing(
          p.stage === "download"
            ? `Downloading the listening model (first time only, about 260 MB): ${p.percent}%`
            : p.stage === "listening"
              ? `Listening to ${Math.max(1, Math.round(p.seconds / 60))} min of sound… (a 5-minute voice note takes about 1–3 minutes on a laptop)`
              : "Done",
        ),
      );
      setNotes((n) => `${n.trim() ? `${n.trim()}\n\n` : ""}What it says:\n${text}`);
      showToast("Transcript added to the notes. Check it, then make the card.");
    } catch (e) {
      setError(`Couldn't listen to it: ${(e as Error).message}. You can still write what it says in the notes.`);
    } finally {
      setHearing(null);
    }
  }
  const [busy, setBusy] = useState<"make" | "save" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<StudioCard | null>(null);
  const [lang, setLang] = useState<"en" | "sw">("sw");
  const [published, setPublished] = useState<string | null>(null);
  const fk = file ? kindOf(file) : null;
  const canPublish = studio.can("content.publish");
  // Step 86: publish at the next daily drop (Studio → Discover sets the time)
  const discover = useDiscoverConfig();
  const nextDrop = discover.dropAt ? (dropTimes(discover.dropAt, new Date())?.next ?? null) : null;
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
          // Video: a few stills so the AI can read words on screen (Step 85)
          const frames = fk === "video" ? await stills(file).catch(() => [] as string[]) : [];
          if (notes.trim().length < 20 && frames.length === 0) throw new Error("Tap “Listen to it” first, or write what it says in the notes box.");
          const link = fk === "audio" ? await repo.uploadAudio(file, id) : await repo.uploadVideo(file, id);
          media = fk === "audio" ? { audioUrl: link } : { videoUrl: link };
          body = { kind: fk, name: file.name, notes, frames };
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
        photo: imageUrl ? null : d.photo, // null = his own photo
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

  async function save(publish: boolean, at?: Date) {
    if (!item) return;
    setError(null);
    setBusy(publish ? "publish" : "save");
    try {
      // Publishing: goes live straight away (Step 66b: no professional-check gate), or at the next drop (Step 86)
      await repo.save({ ...item, review: publish ? "reviewed" : "draft", ...(at ? { publishAt: at.toISOString() } : {}) }, publish ? "published" : "draft");
      setPublished(publish ? (at ? `drop:${at.toISOString()}` : "published") : "draft");
      showToast(
        publish
          ? at
            ? `Scheduled · goes live at ${at.toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}`
            : "Published · men see it at the top of Discover"
          : "Saved as a draft in Content",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const set = (patch: Partial<StudioCard>) => setCard((c) => (c ? { ...c, ...patch } : c));

  // Step 93: his own background photo, straight from the phone (gallery or camera)
  const ownPhoto = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  async function uploadOwnPhoto(f: File) {
    if (!card) return;
    setError(null);
    setPhotoBusy(true);
    try {
      const ready = await shrinkPhoto(f);
      const link = await repo.uploadImage(ready, card.id);
      set({ imageUrl: link, photo: null });
      showToast("Your photo is on the card");
    } catch (e) {
      setError(`Couldn't add the photo: ${(e as Error).message}`);
    } finally {
      setPhotoBusy(false);
      if (ownPhoto.current) ownPhoto.current.value = "";
    }
  }
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
                    <div className="mt-2 space-y-2 rounded-xl bg-mint/40 px-3 py-2.5 text-xs">
                      <p>
                        The file will play on the card. Tap <b>Listen to it</b> and this browser writes down what it says (free; the recording stays on
                        this computer).{fk === "video" ? " The AI also looks at a few stills from the video to read words on screen." : ""} Check the text in
                        the notes before making the card.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Segmented
                          label="Language spoken"
                          value={hearLang ?? "auto"}
                          onChange={(v) => setHearLang(v === "auto" ? null : (v as "sw" | "en"))}
                          options={[
                            { id: "sw", label: "Kiswahili" },
                            { id: "en", label: "English" },
                            { id: "auto", label: "Mixed" },
                          ]}
                        />
                        <button type="button" className={btn.primary} disabled={hearing !== null || busy !== null} onClick={hear}>
                          {hearing ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />} Listen to it
                        </button>
                      </div>
                      {hearing && <p className="text-ink-soft" aria-live="polite">{hearing}</p>}
                    </div>
                  )}
                </div>
              )}
              <label className="block text-sm">
                <span className="mb-1 block font-semibold">Notes for the AI {fk === "audio" ? "(the transcript goes here)" : "(optional)"}</span>
                <textarea
                  className={`${input} min-h-[80px]`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={fk === "audio" || fk === "video" ? "Tap “Listen to it” above, or write what it teaches here." : "E.g. make it about lasting longer · use only the second recipe · for married men"}
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
                  <legend className="mb-1 font-semibold">Circle on Discover (what men tap at the top)</legend>
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

                {/* Step 86: what pulls men back */}
                <div className="rounded-2xl bg-mint/30 p-3 ring-1 ring-line">
                  <p className="mb-3 text-sm font-bold">Hooks (optional)</p>
                  <HookFields spec={card.action} cardId={card.id} onChange={setAction} />
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold">Background photo</p>
                  <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
                    {/* Step 93: upload his own photo from the phone */}
                    <button
                      type="button"
                      onClick={() => ownPhoto.current?.click()}
                      disabled={photoBusy}
                      className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-forest/50 bg-mint/30 text-forest disabled:opacity-60"
                      title="Upload your own photo"
                    >
                      {photoBusy ? <Loader2 size={22} className="animate-spin" /> : <ImagePlus size={22} />}
                      <span className="text-[0.625rem] font-bold leading-tight">{photoBusy ? "Adding…" : card.imageUrl ? "Change" : "Your photo"}</span>
                    </button>
                    <input
                      ref={ownPhoto}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadOwnPhoto(f);
                      }}
                    />
                    {card.imageUrl && (
                      <button type="button" onClick={() => set({ photo: null })} className={`overflow-hidden rounded-xl ring-2 ${card.photo === null ? "ring-forest" : "ring-transparent"}`} title="Your uploaded photo">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={card.imageUrl} alt="Uploaded" className="aspect-square w-full object-cover" />
                      </button>
                    )}
                    {CARD_PHOTOS.map((p: CardPhoto) => (
                      <button
                        key={p}
                        type="button"
                        // Keeps his uploaded photo in the row, so he can switch back to it
                        onClick={() => set({ photo: p })}
                        className={`overflow-hidden rounded-xl ring-2 ${card.photo === p ? "ring-forest" : "ring-transparent"}`}
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
                  <ActionPost
                    card={{ item: { ...item, coverImageUrl: card!.photo === null && card!.imageUrl ? card!.imageUrl : card!.photo ? photoUrl(card!.photo) : item.coverImageUrl }, spec: item.action! }}
                    first
                    done={false}
                    liked={false}
                    saved={false}
                    series={
                      card!.action.series?.name
                        ? {
                            name: lang === "sw" ? card!.action.series.nameSw || card!.action.series.name : card!.action.series.name,
                            part: card!.action.series.part,
                            total: Math.max(card!.action.series.part + 1, card!.action.series.part),
                            tease: (lang === "sw" ? card!.action.series.teaseSw : card!.action.series.tease) || undefined,
                            wait: discover.seriesWait,
                            last: false,
                          }
                        : undefined
                    }
                  />
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
                  <>
                  <button className={btn.primary} disabled={busy !== null || blocks.length > 0} onClick={() => save(true)}>
                    {busy === "publish" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Publish now
                  </button>
                  {nextDrop && (
                    <button className={btn.ghost} disabled={busy !== null || blocks.length > 0} onClick={() => save(true, nextDrop)} title="Men get one discreet notification at the drop time">
                      <Clock size={15} /> At the next drop ({nextDrop.toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })})
                    </button>
                  )}
                  </>
                ) : (
                  <p className="text-xs text-ink-soft">Your role can save drafts. An editor or owner publishes them from Content.</p>
                )}
              </div>
              {published && (
                <p className="text-sm text-forest">
                  {published === "published"
                    ? "Live. It's at the top of Discover now."
                    : published.startsWith("drop:")
                      ? "Scheduled for the drop. Until then it waits in "
                      : "Saved. Find it in "}
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
