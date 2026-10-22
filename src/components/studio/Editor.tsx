"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Archive,
  CheckCircle2,
  Clock,
  Copy,
  Film,
  History,
  Mic,
  ImagePlus,
  MapPin,
  Loader2,
  OctagonX,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Preview from "./Preview";
import { useStudio } from "@/components/admin/AdminShell";
import type { Version } from "@/lib/content/repo";
import { Notice } from "./StudioGate";
import {
  displayStatus,
  STATUS_LABEL,
  STATUS_STYLE,
} from "@/lib/admin/contentStatus";
import { Confirm, Drawer, btn } from "@/components/admin/ui";
import { useToast } from "@/components/motion/Toast";
import { LIBRARY, TOPICS } from "@/lib/content/library";
import { getContentRepo } from "@/lib/content/repo";
import { KIND_LABEL } from "@/lib/content/select";
import type {
  ContentItem,
  ContentKind,
  ContentStatus,
  QuizQuestion,
  ToolId,
} from "@/lib/content/types";
import { checkClaims } from "@/lib/studio/claims";
import { placesOf, presetFor, type PlaceId } from "@/lib/studio/places";
import type { TopicId } from "@/lib/content/types";
import {
  blankItem,
  fromLines,
  fromParagraphs,
  ID_RULE,
  publishProblems,
  slugify,
  toLines,
  toParagraphs,
} from "@/lib/studio/validate";

const KINDS: ContentKind[] = [
  "reel",
  "article",
  "guide",
  "expert",
  "video",
  "quiz",
  "tool",
  "audio",
  "infographic",
];
const TONES: ContentItem["cover"]["tone"][] = [
  "forest",
  "night",
  "mint",
  "sand",
  "clay",
];
const MOTIFS: ContentItem["cover"]["motif"][] = [
  "rings",
  "waves",
  "arc",
  "grid",
  "dots",
];
const TONE_SWATCH: Record<string, string> = {
  forest: "#0f5c46",
  night: "#06261d",
  mint: "#dff3ea",
  sand: "#f1e8d8",
  clay: "#efdcd0",
};
const TOOLS: { id: ToolId; label: string }[] = [
  { id: "pelvic-floor", label: "Pelvic floor trainer" },
  { id: "doctor-check", label: "Should I see a doctor? check" },
];

type Texts = { body: string; bodySw: string; keyPoints: string; tags: string };
const textsOf = (c: ContentItem): Texts => ({
  body: fromParagraphs(c.body),
  bodySw: fromParagraphs(c.bodySw),
  keyPoints: fromLines(c.keyPoints),
  tags: c.tags.join(", "),
});

const compose = (draft: ContentItem, texts: Texts): ContentItem => ({
  ...draft,
  body: toParagraphs(texts.body),
  bodySw: toParagraphs(texts.bodySw),
  keyPoints: toLines(texts.keyPoints),
  tags: texts.tags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean),
});

type Loaded =
  | { base: ContentItem; status: ContentStatus | null; copyOfBuiltIn: boolean }
  | "missing";

export default function Editor({
  id,
  preset,
  copyOf,
}: {
  id: string | null;
  preset?: { place: PlaceId | null; topic: TopicId | null };
  /** Duplicate: start a new item from this one */
  copyOf?: string | null;
}) {
  const studio = useStudio();
  const canPublish = studio.can("content.publish");
  const fresh = () =>
    presetFor(blankItem(), preset?.place ?? null, preset?.topic ?? null);
  const router = useRouter();
  const showToast = useToast();
  const repo = getContentRepo();

  const [loaded, setLoaded] = useState<Loaded | null>(
    id || copyOf ? null : { base: fresh(), status: null, copyOfBuiltIn: false },
  );
  const [takenIds, setTakenIds] = useState<Set<string>>(
    new Set(LIBRARY.map((c) => c.id)),
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draft, setDraft] = useState<ContentItem>(blankItem());
  const [texts, setTexts] = useState<Texts>(textsOf(blankItem()));
  const [savedJson, setSavedJson] = useState("");
  const [idTouched, setIdTouched] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const quickVideo = useRef<HTMLInputElement>(null);
  // Reels get a short form (video, caption, topic). "More options" opens the full editor.
  const [fullForm, setFullForm] = useState(false);
  const audioInput = useRef<HTMLInputElement>(null);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Load: from the database first, otherwise a built-in item to copy
  useEffect(() => {
    repo
      .listAll()
      .then((all) => {
        setTakenIds(
          new Set([...LIBRARY.map((c) => c.id), ...all.map((c) => c.id)]),
        );
        const taken = new Set([
          ...LIBRARY.map((c) => c.id),
          ...all.map((c) => c.id),
        ]);
        if (!id && copyOf) {
          // Duplicate: same content, new address, saved as a new draft
          const src =
            all.find((c) => c.id === copyOf) ??
            LIBRARY.find((c) => c.id === copyOf);
          if (!src) return setLoaded("missing");
          let newId = slugify(src.title + " copy");
          for (let n = 2; taken.has(newId); n++)
            newId = slugify(src.title + " copy " + n);
          setLoaded({
            base: {
              ...src,
              id: newId,
              title: src.title + " (copy)",
              status: "draft",
              featured: undefined,
              publishAt: undefined,
              reviewNote: undefined,
              fixture: false,
              builtIn: false,
              updatedAt: undefined,
            },
            status: null,
            copyOfBuiltIn: false,
          });
          return;
        }
        if (!id) return;
        const mine = all.find((c) => c.id === id);
        const builtIn = LIBRARY.find((c) => c.id === id);
        if (mine)
          setLoaded({
            base: mine,
            status: mine.status ?? "draft",
            copyOfBuiltIn: Boolean(builtIn),
          });
        else if (builtIn)
          setLoaded({
            base: {
              ...builtIn,
              fixture: false,
              builtIn: false,
              status: "draft",
            },
            status: null,
            copyOfBuiltIn: true,
          });
        else setLoaded("missing");
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [id, repo, copyOf]);

  useEffect(() => {
    if (!loaded || loaded === "missing") return;
    setDraft(loaded.base);
    setTexts(textsOf(loaded.base));
    // A Kiswahili translation handed over from Admin → AI: filled in, not saved, marked AI-assisted
    try {
      const key = `ms_ai_sw:${loaded.base.id}`;
      const raw = sessionStorage.getItem(key);
      if (raw) {
        sessionStorage.removeItem(key);
        const sw = JSON.parse(raw) as {
          titleSw?: string;
          summarySw?: string;
          bodySw?: string[];
        };
        setDraft((d) => ({
          ...d,
          titleSw: sw.titleSw || d.titleSw,
          summarySw: sw.summarySw || d.summarySw,
          aiGenerated: true,
        }));
        if (Array.isArray(sw.bodySw))
          setTexts((t) => ({ ...t, bodySw: fromParagraphs(sw.bodySw) }));
        showToast("Kiswahili from AI filled in · check it, then save");
      }
    } catch {}
    setSavedJson(
      loaded.status
        ? JSON.stringify(compose(loaded.base, textsOf(loaded.base)))
        : "",
    );
  }, [loaded, showToast]);

  // The item as it will be saved
  const item: ContentItem = useMemo(
    () => compose(draft, texts),
    [draft, texts],
  );

  const status = loaded && loaded !== "missing" ? loaded.status : null; // null = not in the database yet
  const isNew = status === null;
  const claims = useMemo(() => checkClaims(item), [item]);
  const problems = useMemo(() => publishProblems(item), [item]);
  const idTaken =
    isNew &&
    !(loaded !== "missing" && loaded?.copyOfBuiltIn) &&
    takenIds.has(item.id);
  const dirty = JSON.stringify(item) !== savedJson;

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof ContentItem>(key: K, value: ContentItem[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setText = (key: keyof Texts, value: string) =>
    setTexts((t) => ({ ...t, [key]: value }));

  function setTitle(title: string) {
    setDraft((d) => ({
      ...d,
      title,
      id: isNew && !idTouched && !loadedCopy() ? slugify(title) : d.id,
    }));
  }
  const loadedCopy = () =>
    loaded !== null && loaded !== "missing" && loaded.copyOfBuiltIn;

  async function save(next: ContentStatus) {
    setError(null);
    if (!ID_RULE.test(item.id))
      return setError("Add a title first (it makes the web address).");
    if (idTaken)
      return setError(
        `The web address "${item.id}" is already used. Change it below the title.`,
      );
    if ((next === "published" || next === "review") && problems.length)
      return setError(
        next === "review"
          ? "Not ready for review yet. See the checklist."
          : "Not ready to publish yet. See the checklist.",
      );
    const scheduled =
      next === "published" &&
      item.publishAt &&
      new Date(item.publishAt) > new Date();
    setBusy(next);
    try {
      const saved = await repo.save(item, next);
      const merged = {
        ...item,
        status: saved.status,
        updatedAt: saved.updatedAt,
      };
      setSavedJson(JSON.stringify(merged));
      setDraft(merged);
      setLoaded({ base: merged, status: next, copyOfBuiltIn: loadedCopy() });
      showToast(
        scheduled
          ? `Scheduled for ${new Date(item.publishAt!).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
          : next === "published"
            ? status === "published"
              ? "Live version updated"
              : "Published"
            : next === "review"
              ? "Sent for review"
              : next === "archived"
                ? "Archived"
                : "Draft saved",
      );
      if (isNew)
        router.replace(`/studio/edit?id=${encodeURIComponent(item.id)}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function openHistory() {
    setShowHistory(true);
    setVersions(null);
    try {
      setVersions(await repo.listVersions(item.id));
    } catch (e) {
      setShowHistory(false);
      setError((e as Error).message);
    }
  }

  function loadVersion(v: Version) {
    // Keeps this item's address; you review the old text, then save or publish it again
    const restored = {
      ...v.item,
      id: item.id,
      status: item.status,
      updatedAt: item.updatedAt,
    };
    setDraft(restored);
    setTexts(textsOf(restored));
    setShowHistory(false);
    showToast("Older version loaded · save to keep it");
  }

  async function uploadAudio(file: File | undefined) {
    if (!file) return;
    if (!ID_RULE.test(item.id))
      return setError("Add a title first, then the audio.");
    setError(null);
    setBusy("audio");
    try {
      set("audioUrl", await repo.uploadAudio(file, item.id));
      showToast("Audio added · save to keep it");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      if (audioInput.current) audioInput.current.value = "";
    }
  }

  async function remove() {
    setConfirmDelete(false);
    setBusy("delete");
    try {
      await repo.remove(item.id);
      setSavedJson(JSON.stringify(item));
      showToast("Deleted");
      router.push("/studio/content");
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!ID_RULE.test(item.id))
      return setError("Add a title first, then the photo.");
    setError(null);
    setBusy("image");
    try {
      set("coverImageUrl", await repo.uploadImage(file, item.id));
      showToast("Photo added · save to keep it");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function uploadVideo(file: File | undefined) {
    if (!file) return;
    let vid = item.id;
    if (!ID_RULE.test(vid)) {
      if (item.kind !== "reel")
        return setError("Add a title first, then the video.");
      // A reel can start with the video: it gets its own web address
      vid = `reel-${Date.now().toString(36)}`;
      setIdTouched(true);
      set("id", vid);
    }
    setError(null);
    setBusy("video");
    try {
      set("videoUrl", await repo.uploadVideo(file, vid));
      showToast("Video added · save to keep it");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      if (videoInput.current) videoInput.current.value = "";
    }
  }

  if (loadError) return <Notice title="Couldn't load">{loadError}</Notice>;
  if (loaded === "missing")
    return (
      <Notice title="Not found">
        Nothing with the address &ldquo;{id}&rdquo;.{" "}
        <Link href="/studio" className="font-semibold text-forest">
          Back to content
        </Link>
      </Notice>
    );
  if (!loaded)
    return (
      <div className="flex justify-center py-20 text-ink-soft">
        <Loader2 className="animate-spin" />
      </div>
    );

  const quick = item.kind === "reel" && !fullForm;
  const caption = item.summary || item.title;
  /** One caption, written once: the first line is the title, the whole thing the caption, same in both languages. */
  function setCaption(text: string) {
    const first = text.split("\n")[0].trim();
    const title =
      first.length > 100 ? first.slice(0, 100).replace(/\s+\S*$/, "") : first;
    setDraft((d) => ({
      ...d,
      title,
      titleSw: title || undefined,
      summary: text,
      summarySw: text || undefined,
      inManFeed: false,
      id: isNew && !idTouched && !loadedCopy() ? slugify(title) : d.id,
    }));
  }

  const blocks = claims.filter((c) => c.level === "block");
  const warns = claims.filter((c) => c.level === "warn");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/studio/content"
          className="flex items-center gap-1 text-sm text-ink-soft"
        >
          <ArrowLeft size={16} /> All content
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {status && (
            <>
              <button type="button" onClick={openHistory} className={btn.small}>
                <History size={13} /> History
              </button>
              <Link
                href={`/studio/edit?copy=${encodeURIComponent(item.id)}`}
                className={btn.small}
              >
                <Copy size={13} /> Duplicate
              </Link>
            </>
          )}
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${status ? STATUS_STYLE[displayStatus({ status, publishAt: loaded.base.publishAt })] : "bg-bg text-ink-soft ring-line"}`}
          >
            {status
              ? STATUS_LABEL[
                  displayStatus({ status, publishAt: loaded.base.publishAt })
                ]
              : "Not saved yet"}
            {dirty && status ? " · unsaved changes" : ""}
          </span>
        </div>
      </div>
      {status === "review" && loaded.base.reviewNote && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>Review note:</b> {loaded.base.reviewNote}
        </p>
      )}

      {loaded.copyOfBuiltIn && (
        <p className="rounded-2xl bg-mint/60 px-4 py-3 text-sm text-forest-deep">
          {isNew
            ? "You're editing a copy of a built-in item. When you publish it, your version replaces the built-in one in the app."
            : "This is your edited copy of a built-in item. Published = your version shows in the app."}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {quick ? (
            <Section title="New reel">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                Making something else?
                {KINDS.filter((k) => k !== "reel")
                  .slice(0, 3)
                  .map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => set("kind", k)}
                      className="font-semibold text-forest underline"
                    >
                      {KIND_LABEL[k]}
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => setFullForm(true)}
                  className="font-semibold text-forest underline"
                >
                  More…
                </button>
              </div>

              {/* 1. The video */}
              {item.videoUrl ? (
                <div className="flex items-end gap-3">
                  <video
                    src={item.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-[9/16] w-36 shrink-0 rounded-2xl bg-black"
                  />
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => quickVideo.current?.click()}
                      disabled={busy === "video"}
                      className={btn.small}
                    >
                      {busy === "video" ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Film size={13} />
                      )}{" "}
                      Change video
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => quickVideo.current?.click()}
                  disabled={busy === "video"}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-forest/40 bg-mint/20 py-10 text-forest disabled:opacity-60"
                >
                  {busy === "video" ? (
                    <Loader2 size={28} className="animate-spin" />
                  ) : (
                    <Film size={28} />
                  )}
                  <span className="font-bold">
                    {busy === "video" ? "Uploading…" : "Choose the video"}
                  </span>
                  <span className="text-xs text-ink-soft">
                    Upright, under 50 MB
                  </span>
                </button>
              )}
              <input
                ref={quickVideo}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => uploadVideo(e.target.files?.[0])}
              />

              {/* 2. The caption */}
              <Field
                label="Caption"
                hint="Write it once, in Kiswahili or English. The first line is the title."
              >
                <textarea
                  className={`${input} min-h-24`}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="e.g. Mchanganyiko wa vitunguu saumu, tangawizi na manjano"
                  maxLength={600}
                />
              </Field>

              {/* 3. The topic */}
              <Field group label="Topic">
                <div className="flex flex-wrap gap-1.5">
                  {TOPICS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => set("topic", t.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${item.topic === t.id ? "bg-forest text-white ring-forest" : "ring-line"}`}
                    >
                      {t.short}
                    </button>
                  ))}
                </div>
              </Field>

              {(problems.length > 0 || blocks.length > 0) &&
                (item.videoUrl || caption) && (
                  <ul className="space-y-1 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
                    {problems.map((p) => (
                      <li key={p}>• {p}</li>
                    ))}
                  </ul>
                )}
              <button
                type="button"
                onClick={() => setFullForm(true)}
                className="text-xs font-semibold text-ink-soft underline"
              >
                More options (cover photo, schedule, separate Kiswahili text…)
              </button>
            </Section>
          ) : (
            <>
              {/* Basics */}
              <Section title="What is it?">
                <div className="flex flex-wrap gap-2">
                  {KINDS.map((k) => (
                    <Chip
                      key={k}
                      on={item.kind === k}
                      onClick={() => set("kind", k)}
                    >
                      {KIND_LABEL[k]}
                    </Chip>
                  ))}
                </div>
                <Field group label="Topic">
                  <div className="flex flex-wrap gap-2">
                    {TOPICS.map((t) => (
                      <Chip
                        key={t.id}
                        on={item.topic === t.id}
                        onClick={() => set("topic", t.id)}
                      >
                        {t.title}
                      </Chip>
                    ))}
                  </div>
                </Field>
              </Section>

              <Section title="Title and summary">
                <Field label="Title (English)">
                  <input
                    className={input}
                    value={item.title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Why sleep matters for erections"
                    maxLength={160}
                  />
                </Field>
                <Field
                  label="Web address"
                  hint={
                    isNew && !loaded.copyOfBuiltIn
                      ? "Made from the title. Can't change after the first save."
                      : "Fixed after the first save."
                  }
                >
                  <input
                    className={`${input} font-mono text-xs`}
                    value={item.id}
                    disabled={!isNew || loaded.copyOfBuiltIn}
                    onChange={(e) => {
                      setIdTouched(true);
                      set(
                        "id",
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "-"),
                      );
                    }}
                  />
                  {idTaken && (
                    <p className="mt-1 text-xs text-red-700">
                      Already used. Change it a little, e.g. add
                      &ldquo;-2&rdquo;.
                    </p>
                  )}
                </Field>
                <Field
                  label="Title (Kiswahili)"
                  hint="Optional, but needed if you add Kiswahili text."
                >
                  <input
                    className={input}
                    value={item.titleSw ?? ""}
                    onChange={(e) =>
                      set("titleSw", e.target.value || undefined)
                    }
                    maxLength={160}
                  />
                </Field>
                <Field
                  label="Summary"
                  hint="What he gains from it, in one or two short sentences."
                >
                  <textarea
                    className={`${input} min-h-20`}
                    value={item.summary}
                    onChange={(e) => set("summary", e.target.value)}
                  />
                </Field>
                <Field
                  label="Summary (Kiswahili)"
                  hint="Optional. Shown when a man uses the app in Kiswahili."
                >
                  <textarea
                    lang="sw"
                    className={`${input} min-h-20`}
                    value={item.summarySw ?? ""}
                    onChange={(e) =>
                      set("summarySw", e.target.value || undefined)
                    }
                  />
                </Field>
              </Section>

              {/* Content by type */}
              <Section
                title={
                  item.kind === "expert"
                    ? "Question and answer"
                    : item.kind === "video"
                      ? "Video"
                      : item.kind === "reel"
                        ? "Reel (vertical video)"
                        : item.kind === "audio"
                          ? "Audio"
                          : item.kind === "infographic"
                            ? "Infographic"
                            : item.kind === "quiz"
                              ? "Quiz"
                              : "Text"
                }
              >
                {item.kind === "expert" && (
                  <Field label="The question a man asked">
                    <textarea
                      className={`${input} min-h-16`}
                      value={item.question ?? ""}
                      onChange={(e) =>
                        set("question", e.target.value || undefined)
                      }
                    />
                  </Field>
                )}
                {item.kind === "infographic" && (
                  <p className="rounded-2xl bg-mint/60 px-4 py-3 text-xs text-forest-deep">
                    The infographic is the <b>cover photo</b> (upload it under
                    Cover below). It&apos;s shown full size on the page; the
                    text underneath is optional.
                  </p>
                )}
                {item.kind === "audio" && (
                  <div className="space-y-3">
                    {item.audioUrl && (
                      <audio
                        src={item.audioUrl}
                        controls
                        preload="metadata"
                        className="w-full"
                      />
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => audioInput.current?.click()}
                        disabled={busy === "audio"}
                        className="flex items-center gap-2 rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {busy === "audio" ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Mic size={16} />
                        )}
                        {busy === "audio"
                          ? "Uploading…"
                          : item.audioUrl
                            ? "Change audio"
                            : "Upload audio"}
                      </button>
                      {item.audioUrl && (
                        <button
                          type="button"
                          onClick={() => set("audioUrl", undefined)}
                          className="flex items-center gap-1 text-sm font-semibold text-ink-soft"
                        >
                          <X size={14} /> Remove audio
                        </button>
                      )}
                      <input
                        ref={audioInput}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => uploadAudio(e.target.files?.[0])}
                      />
                      <span className="text-xs text-ink-soft">
                        MP3, M4A, AAC, OGG or WAV, under 40 MB.
                      </span>
                    </div>
                    <Field
                      label="Or paste an audio link"
                      hint="A direct https link to an .mp3 or .m4a file."
                    >
                      <input
                        className={input}
                        type="url"
                        placeholder="https://…/episode.mp3"
                        value={item.audioUrl ?? ""}
                        onChange={(e) =>
                          set("audioUrl", e.target.value.trim() || undefined)
                        }
                      />
                    </Field>
                    <Field
                      label="Key points"
                      hint="One per line. Shown under the player."
                    >
                      <textarea
                        className={`${input} min-h-28`}
                        value={texts.keyPoints}
                        onChange={(e) => setText("keyPoints", e.target.value)}
                      />
                    </Field>
                  </div>
                )}
                {item.kind === "reel" && (
                  <p className="rounded-2xl bg-mint/60 px-4 py-3 text-xs text-forest-deep">
                    A reel is a <b>vertical video</b> (filmed upright on a
                    phone, 9:16), best under 90 seconds. It shows in the Reels
                    row on Discover and in the feed, and plays full screen. The
                    title and summary are its caption. A cover photo is optional
                    (the first frame is used).
                  </p>
                )}
                {(item.kind === "video" || item.kind === "reel") && (
                  <div className="space-y-3">
                    {item.videoUrl && (
                      <video
                        src={item.videoUrl}
                        controls
                        playsInline
                        preload="metadata"
                        className={
                          item.kind === "reel"
                            ? "mx-auto aspect-[9/16] max-h-[28rem] rounded-2xl bg-black"
                            : "aspect-video w-full rounded-2xl bg-black"
                        }
                      />
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => videoInput.current?.click()}
                        disabled={busy === "video"}
                        className="flex items-center gap-2 rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {busy === "video" ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Film size={16} />
                        )}
                        {busy === "video"
                          ? "Uploading…"
                          : item.videoUrl
                            ? "Change video"
                            : "Upload video"}
                      </button>
                      {item.videoUrl && (
                        <button
                          type="button"
                          onClick={() => set("videoUrl", undefined)}
                          className="flex items-center gap-1 text-sm font-semibold text-ink-soft"
                        >
                          <X size={14} /> Remove video
                        </button>
                      )}
                      <input
                        ref={videoInput}
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        className="hidden"
                        onChange={(e) => uploadVideo(e.target.files?.[0])}
                      />
                      <span className="text-xs text-ink-soft">
                        {item.kind === "reel"
                          ? "MP4 or MOV, upright, under 50 MB. Best under 90 seconds."
                          : "MP4, WebM or MOV, under 50 MB. Short is best: 2 minutes or less."}
                      </span>
                    </div>
                    <Field
                      label="Or paste a video link"
                      hint="A direct https link to an .mp4 file. Instagram links go in the post's origin, not here."
                    >
                      <input
                        className={input}
                        type="url"
                        placeholder="https://…/video.mp4"
                        value={item.videoUrl ?? ""}
                        onChange={(e) =>
                          set("videoUrl", e.target.value.trim() || undefined)
                        }
                      />
                    </Field>
                  </div>
                )}
                {item.kind === "video" && (
                  <Field
                    label="Key points"
                    hint="One per line. Shown under the video."
                  >
                    <textarea
                      className={`${input} min-h-28`}
                      value={texts.keyPoints}
                      onChange={(e) => setText("keyPoints", e.target.value)}
                    />
                  </Field>
                )}
                {item.kind === "quiz" && (
                  <QuizEditor
                    value={item.quiz ?? []}
                    onChange={(q) => set("quiz", q)}
                  />
                )}
                {item.kind === "tool" && (
                  <Field group label="Which tool">
                    <div className="flex flex-wrap gap-2">
                      {TOOLS.map((t) => (
                        <Chip
                          key={t.id}
                          on={item.tool === t.id}
                          onClick={() => set("tool", t.id)}
                        >
                          {t.label}
                        </Chip>
                      ))}
                    </div>
                  </Field>
                )}
                <Field
                  label={
                    item.kind === "expert"
                      ? "Answer (English)"
                      : "Text (English)"
                  }
                  hint='Leave an empty line between paragraphs. Start a line with "## " to make a heading.'
                >
                  <textarea
                    className={`${input} min-h-56 leading-relaxed`}
                    value={texts.body}
                    onChange={(e) => setText("body", e.target.value)}
                  />
                </Field>
                <Field
                  label="Text (Kiswahili)"
                  hint="Optional. Readers can switch language on the page."
                >
                  <textarea
                    lang="sw"
                    className={`${input} min-h-40 leading-relaxed`}
                    value={texts.bodySw}
                    onChange={(e) => setText("bodySw", e.target.value)}
                  />
                </Field>
              </Section>

              {/* Where men see it */}
              <Section title="Where it shows">
                <ul className="flex flex-wrap gap-2">
                  {placesOf(item).map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-1 rounded-full bg-mint/70 px-3 py-1.5 text-xs font-semibold text-forest-deep"
                    >
                      <MapPin size={12} />
                      {p.id === "library"
                        ? `Library · ${TOPICS.find((t) => t.id === item.topic)?.title ?? "no topic"}`
                        : p.title}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-ink-soft">
                  {item.kind === "reel"
                    ? "Reels show in the Reels row and between the cards on Discover. To put this one first for everyone, pin it in "
                    : "Discover now shows reels and “do this” cards. Guides, articles and videos reach men through search, Saved, Kito, topic pages and links. To pin or hide things on Discover, use "}
                  <Link
                    href="/studio/discover"
                    className="font-semibold text-forest underline"
                  >
                    Studio → Discover
                  </Link>
                  .
                </p>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 accent-forest"
                    checked={Boolean(item.inManFeed)}
                    onChange={(e) => set("inManFeed", e.target.checked)}
                  />
                  <span>
                    <b>Show as a daily lesson on the Man tab</b>
                    <span className="block text-xs text-ink-soft">
                      He earns the points below when he marks it as read.
                    </span>
                  </span>
                </label>
              </Section>

              {/* Publishing: schedule, review, AI */}
              <Section title="Publishing">
                <Field
                  label="Go live at (optional)"
                  hint={
                    item.publishAt && new Date(item.publishAt) > new Date()
                      ? "Scheduled: men see it from this time. Leave empty to go live as soon as it's published."
                      : "Leave empty to go live as soon as it's published. Pick a future time to schedule it."
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="datetime-local"
                      className={`${input} max-w-xs`}
                      value={item.publishAt ? toLocalInput(item.publishAt) : ""}
                      onChange={(e) =>
                        set(
                          "publishAt",
                          e.target.value
                            ? new Date(e.target.value).toISOString()
                            : undefined,
                        )
                      }
                    />
                    {item.publishAt && (
                      <button
                        type="button"
                        onClick={() => set("publishAt", undefined)}
                        className="text-xs font-semibold text-ink-soft"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </Field>
                <Field
                  label="Note for review (optional)"
                  hint="What the writer or editor should know. Shown at the top while it's in review."
                >
                  <textarea
                    className={`${input} min-h-16`}
                    maxLength={500}
                    value={item.reviewNote ?? ""}
                    onChange={(e) =>
                      set("reviewNote", e.target.value || undefined)
                    }
                  />
                </Field>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 accent-forest"
                    checked={Boolean(item.aiGenerated)}
                    onChange={(e) =>
                      set("aiGenerated", e.target.checked || undefined)
                    }
                  />
                  <span>
                    <b>Drafted with AI help</b>
                    <span className="block text-xs text-ink-soft">
                      For your records only. Staff can publish it straight away.
                    </span>
                  </span>
                </label>
              </Section>

              {/* Look */}
              <Section title="Cover">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={busy === "image"}
                    className="flex items-center gap-2 rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {busy === "image" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ImagePlus size={16} />
                    )}
                    {item.coverImageUrl ? "Change photo" : "Upload photo"}
                  </button>
                  {item.coverImageUrl && (
                    <button
                      type="button"
                      onClick={() => set("coverImageUrl", undefined)}
                      className="flex items-center gap-1 text-sm font-semibold text-ink-soft"
                    >
                      <X size={14} /> Remove photo
                    </button>
                  )}
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => upload(e.target.files?.[0])}
                  />
                  <span className="text-xs text-ink-soft">
                    JPG, PNG or WebP, under 3 MB. No intimate photos.
                  </span>
                </div>
                {!item.coverImageUrl && (
                  <Field group label="Or a drawn cover">
                    <div className="flex flex-wrap items-center gap-2">
                      {TONES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          aria-label={t}
                          aria-pressed={item.cover.tone === t}
                          onClick={() =>
                            set("cover", { ...item.cover, tone: t })
                          }
                          className={`h-8 w-8 rounded-full ring-1 ring-line ${item.cover.tone === t ? "outline-2 outline-offset-2 outline-forest" : ""}`}
                          style={{ background: TONE_SWATCH[t] }}
                        />
                      ))}
                      <span className="mx-1 h-6 w-px bg-line" />
                      {MOTIFS.map((m) => (
                        <Chip
                          key={m}
                          on={item.cover.motif === m}
                          onClick={() =>
                            set("cover", { ...item.cover, motif: m })
                          }
                        >
                          {m[0].toUpperCase() + m.slice(1)}
                        </Chip>
                      ))}
                    </div>
                  </Field>
                )}
              </Section>

              {/* Details */}
              <Section title="Details">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Minutes to read">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      className={input}
                      value={item.minutes}
                      onChange={(e) =>
                        set("minutes", clamp(e.target.value, 1, 60, 3))
                      }
                    />
                  </Field>
                  <Field
                    label="Priority (0–100)"
                    hint="Higher comes first in search, topic pages and the Man tab."
                  >
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className={input}
                      value={item.priority}
                      onChange={(e) =>
                        set("priority", clamp(e.target.value, 0, 100, 50))
                      }
                    />
                  </Field>
                  <Field label="Points">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className={input}
                      value={item.points ?? 10}
                      onChange={(e) =>
                        set("points", clamp(e.target.value, 0, 100, 10))
                      }
                    />
                  </Field>
                </div>
                <Field
                  label="Tags"
                  hint="Separate with commas. Helps search, e.g. sleep, energy, usingizi"
                >
                  <input
                    className={input}
                    value={texts.tags}
                    onChange={(e) => setText("tags", e.target.value)}
                  />
                </Field>
                <Field
                  label="Source"
                  hint="Shown to readers: who wrote it and where facts come from."
                >
                  <input
                    className={input}
                    value={item.source}
                    onChange={(e) => set("source", e.target.value)}
                  />
                </Field>
              </Section>
            </>
          )}
        </div>

        {/* Right side: checks and preview */}
        <aside className="space-y-5">
          <div
            className={`space-y-3 rounded-3xl bg-surface p-5 ring-1 ring-line ${quick ? "hidden" : ""}`}
          >
            <p className="font-bold">Claim check</p>
            {claims.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-forest">
                <CheckCircle2 size={16} /> No selling, promises or contact
                details found.
              </p>
            ) : (
              <ul className="space-y-2">
                {[...blocks, ...warns].map((c, i) => (
                  <li
                    key={i}
                    className={`flex gap-2 rounded-2xl px-3 py-2 text-xs ${c.level === "block" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}
                  >
                    {c.level === "block" ? (
                      <OctagonX size={14} className="mt-px shrink-0" />
                    ) : (
                      <AlertTriangle size={14} className="mt-px shrink-0" />
                    )}
                    <span>
                      <b>&ldquo;{c.match}&rdquo;</b> · {c.message}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="pt-1 font-bold">Ready to publish?</p>
            {problems.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-forest">
                <CheckCircle2 size={16} /> Yes, everything needed is there.
              </p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-xs text-ink-soft">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </div>
          <Preview item={item} />
        </aside>
      </div>

      {/* Actions: stick to the bottom of the editor while scrolling */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          {error ? (
            <p role="alert" className="mr-auto max-w-md text-sm text-red-700">
              {error}
            </p>
          ) : (
            <p className="mr-auto hidden text-xs text-ink-soft sm:block">
              {status === "published"
                ? item.publishAt && new Date(item.publishAt) > new Date()
                  ? "Scheduled. Men see it from the time you set."
                  : "Men can see this now."
                : status === "review"
                  ? canPublish
                    ? "Waiting for your review."
                    : "Waiting for an editor to review."
                  : canPublish
                    ? "Only staff can see drafts."
                    : "Writers submit for review; an editor publishes."}
            </p>
          )}
          {status &&
            status !== "published" &&
            (canPublish || status !== "archived") && (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={!!busy}
                className={ghost}
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          {status === "published" && canPublish && (
            <>
              <button
                onClick={() => save("archived")}
                disabled={!!busy}
                className={ghost}
              >
                <Archive size={14} /> Archive
              </button>
              <button
                onClick={() => save("draft")}
                disabled={!!busy}
                className={ghost}
              >
                Unpublish
              </button>
            </>
          )}
          {status !== "published" && (
            <button
              onClick={() => save("draft")}
              disabled={!!busy || (!dirty && status === "draft")}
              className={ghost}
            >
              {busy === "draft" && (
                <Loader2 size={14} className="animate-spin" />
              )}
              {status === "archived"
                ? "Restore as draft"
                : status === "review"
                  ? "Back to draft"
                  : "Save draft"}
            </button>
          )}
          {!canPublish &&
            status !== "published" &&
            status !== "archived" &&
            (status !== "review" || dirty) && (
              <button
                onClick={() => save("review")}
                disabled={!!busy || problems.length > 0}
                className={canPublish ? ghost : primaryBtn}
              >
                {busy === "review" && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                {status === "review"
                  ? "Save review changes"
                  : "Submit for review"}
              </button>
            )}
          {canPublish ? (
            <button
              onClick={() => save("published")}
              disabled={
                !!busy ||
                problems.length > 0 ||
                (status === "published" && !dirty)
              }
              className={primaryBtn}
            >
              {busy === "published" && (
                <Loader2 size={14} className="animate-spin" />
              )}
              {item.publishAt && new Date(item.publishAt) > new Date()
                ? status === "published"
                  ? "Update schedule"
                  : "Schedule"
                : status === "published"
                  ? "Update live version"
                  : "Publish"}
            </button>
          ) : (
            status === "published" && (
              <p className="text-xs text-ink-soft">
                Live content can only be changed by an editor or owner.
              </p>
            )
          )}
        </div>
      </div>

      <Confirm
        open={confirmDelete}
        title={`Delete "${item.title}"?`}
        confirmLabel="Delete for good"
        danger
        typeToConfirm="delete"
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      >
        It&apos;s removed from the Studio
        {status === "published" ? " and from the app" : ""}. This can&apos;t be
        undone. Earlier versions are deleted too. To keep it out of the app but
        keep a copy, use Archive instead.
      </Confirm>

      <Drawer
        open={showHistory}
        title="Version history"
        onClose={() => setShowHistory(false)}
      >
        {versions === null ? (
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-ink-soft">
            No earlier versions yet. Each time you save a change, the previous
            version is kept here (the last 30).
          </p>
        ) : (
          <ul className="space-y-2">
            {versions.map((v) => (
              <li key={v.id} className="rounded-xl p-3 ring-1 ring-line">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {v.item.title}
                    </p>
                    <p className="text-[0.6875rem] text-ink-soft">
                      <Clock size={11} className="mr-1 inline" />
                      {new Date(v.savedAt).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · was {v.status}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-ink-soft">
                      {v.item.summary}
                    </p>
                  </div>
                  <button onClick={() => loadVersion(v)} className={btn.small}>
                    Load
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </div>
  );
}

function QuizEditor({
  value,
  onChange,
}: {
  value: QuizQuestion[];
  onChange: (q: QuizQuestion[]) => void;
}) {
  const update = (i: number, patch: Partial<QuizQuestion>) =>
    onChange(value.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  return (
    <div className="space-y-4">
      {value.map((q, i) => (
        <div
          key={i}
          className="space-y-3 rounded-2xl bg-bg p-4 ring-1 ring-line"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-ink-soft">Question {i + 1}</p>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="text-xs font-semibold text-ink-soft"
            >
              Remove
            </button>
          </div>
          <input
            className={input}
            placeholder="Question"
            value={q.q}
            onChange={(e) => update(i, { q: e.target.value })}
          />
          {q.options.map((o, oi) => (
            <label key={oi} className="flex items-center gap-2">
              <input
                type="radio"
                name={`answer-${i}`}
                className="accent-forest"
                checked={q.answer === oi}
                onChange={() => update(i, { answer: oi })}
                aria-label="Correct answer"
              />
              <input
                className={input}
                placeholder={`Answer ${oi + 1}`}
                value={o}
                onChange={(e) =>
                  update(i, {
                    options: q.options.map((x, xi) =>
                      xi === oi ? e.target.value : x,
                    ),
                  })
                }
              />
            </label>
          ))}
          <p className="text-[0.6875rem] text-ink-soft">
            Tick the circle next to the correct answer.
          </p>
          <input
            className={input}
            placeholder="Why this is the answer (shown after he answers)"
            value={q.explain}
            onChange={(e) => update(i, { explain: e.target.value })}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...value,
            { q: "", options: ["", "", ""], answer: 0, explain: "" },
          ])
        }
        className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-forest ring-1 ring-line"
      >
        <Plus size={14} /> Add question
      </button>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-line">
      <h2 className="font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** A labelled field. `group` is for rows of buttons (a <label> would make clicks on the text press the first button). */
function Field({
  label,
  hint,
  group,
  children,
}: {
  label: string;
  hint?: string;
  group?: boolean;
  children: React.ReactNode;
}) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block">
      <span className="text-xs font-semibold text-ink-soft">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && (
        <span className="mt-1 block text-[0.6875rem] text-ink-soft">
          {hint}
        </span>
      )}
    </Tag>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${on ? "bg-forest-deep text-white" : "bg-bg text-ink-soft ring-1 ring-line"}`}
    >
      {children}
    </button>
  );
}

/** ISO time → value for <input type="datetime-local"> in local time */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const clamp = (v: string, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const input =
  "w-full rounded-2xl bg-bg px-4 py-2.5 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-forest disabled:opacity-60";
const primaryBtn =
  "flex items-center gap-1.5 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40";
const ghost =
  "flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-line disabled:opacity-40";
