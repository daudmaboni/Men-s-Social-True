"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Archive,
  CheckCircle2,
  ImagePlus,
  Loader2,
  OctagonX,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Preview from "./Preview";
import { Notice } from "./StudioGate";
import { STATUS_STYLE } from "./ContentList";
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
  "article",
  "guide",
  "expert",
  "video",
  "quiz",
  "tool",
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

export default function Editor({ id }: { id: string | null }) {
  const router = useRouter();
  const showToast = useToast();
  const repo = getContentRepo();

  const [loaded, setLoaded] = useState<Loaded | null>(
    id ? null : { base: blankItem(), status: null, copyOfBuiltIn: false },
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

  // Load: from the database first, otherwise a built-in item to copy
  useEffect(() => {
    repo
      .listAll()
      .then((all) => {
        setTakenIds(
          new Set([...LIBRARY.map((c) => c.id), ...all.map((c) => c.id)]),
        );
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
  }, [id, repo]);

  useEffect(() => {
    if (!loaded || loaded === "missing") return;
    setDraft(loaded.base);
    setTexts(textsOf(loaded.base));
    setSavedJson(
      loaded.status
        ? JSON.stringify(compose(loaded.base, textsOf(loaded.base)))
        : "",
    );
  }, [loaded]);

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
    if (next === "published" && problems.length)
      return setError("Not ready to publish yet. See the checklist.");
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
        next === "published"
          ? status === "published"
            ? "Live version updated"
            : "Published"
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

  async function remove() {
    if (
      !window.confirm(`Delete "${item.title}" for good? This can't be undone.`)
    )
      return;
    setBusy("delete");
    try {
      await repo.remove(item.id);
      setSavedJson(JSON.stringify(item));
      showToast("Deleted");
      router.push("/studio");
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

  const blocks = claims.filter((c) => c.level === "block");
  const warns = claims.filter((c) => c.level === "warn");

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/studio"
          className="flex items-center gap-1 text-sm text-ink-soft"
        >
          <ArrowLeft size={16} /> All content
        </Link>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${status ? STATUS_STYLE[status] : "bg-bg text-ink-soft ring-line"}`}
        >
          {status ? status[0].toUpperCase() + status.slice(1) : "Not saved yet"}
          {dirty && status ? " · unsaved changes" : ""}
        </span>
      </div>

      {loaded.copyOfBuiltIn && (
        <p className="rounded-2xl bg-mint/60 px-4 py-3 text-sm text-forest-deep">
          {isNew
            ? "You're editing a copy of a built-in item. When you publish it, your version replaces the built-in one in the app."
            : "This is your edited copy of a built-in item. Published = your version shows in the app."}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
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
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                  );
                }}
              />
              {idTaken && (
                <p className="mt-1 text-xs text-red-700">
                  Already used. Change it a little, e.g. add &ldquo;-2&rdquo;.
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
                onChange={(e) => set("titleSw", e.target.value || undefined)}
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
          </Section>

          {/* Content by type */}
          <Section
            title={
              item.kind === "expert"
                ? "Question and answer"
                : item.kind === "video"
                  ? "Video"
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
                  onChange={(e) => set("question", e.target.value || undefined)}
                />
              </Field>
            )}
            {item.kind === "video" && (
              <Field
                label="Key points"
                hint="One per line. The video upload comes in a later step."
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
                item.kind === "expert" ? "Answer (English)" : "Text (English)"
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
                      onClick={() => set("cover", { ...item.cover, tone: t })}
                      className={`h-8 w-8 rounded-full ring-1 ring-line ${item.cover.tone === t ? "outline-2 outline-offset-2 outline-forest" : ""}`}
                      style={{ background: TONE_SWATCH[t] }}
                    />
                  ))}
                  <span className="mx-1 h-6 w-px bg-line" />
                  {MOTIFS.map((m) => (
                    <Chip
                      key={m}
                      on={item.cover.motif === m}
                      onClick={() => set("cover", { ...item.cover, motif: m })}
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
                hint="Higher = more likely featured."
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
                  He earns the points above when he marks it as read.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 accent-forest"
                checked={item.review === "reviewed"}
                onChange={(e) =>
                  set("review", e.target.checked ? "reviewed" : "draft")
                }
              />
              <span>
                <b>Checked by a qualified health professional</b>
                <span className="block text-xs text-ink-soft">
                  Only tick this when a doctor or pharmacist has actually read
                  it.
                </span>
              </span>
            </label>
          </Section>
        </div>

        {/* Right side: checks and preview */}
        <aside className="space-y-5">
          <div className="space-y-3 rounded-3xl bg-surface p-5 ring-1 ring-line">
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

      {/* Actions — rendered at page level so the page's entry animation can't move it */}
      {createPortal(
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-5 py-3">
            {error ? (
              <p role="alert" className="mr-auto max-w-md text-sm text-red-700">
                {error}
              </p>
            ) : (
              <p className="mr-auto hidden text-xs text-ink-soft sm:block">
                {status === "published"
                  ? "Men can see this now."
                  : "Only staff can see drafts."}
              </p>
            )}
            {status && status !== "published" && (
              <button onClick={remove} disabled={!!busy} className={ghost}>
                <Trash2 size={14} /> Delete
              </button>
            )}
            {status === "published" && (
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
                {status === "archived" ? "Restore as draft" : "Save draft"}
              </button>
            )}
            <button
              onClick={() => save("published")}
              disabled={
                !!busy ||
                problems.length > 0 ||
                (status === "published" && !dirty)
              }
              className="flex items-center gap-1.5 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
            >
              {busy === "published" && (
                <Loader2 size={14} className="animate-spin" />
              )}
              {status === "published" ? "Update live version" : "Publish"}
            </button>
          </div>
        </div>,
        document.body,
      )}
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
          <p className="text-[11px] text-ink-soft">
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
        <span className="mt-1 block text-[11px] text-ink-soft">{hint}</span>
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

const clamp = (v: string, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const input =
  "w-full rounded-2xl bg-bg px-4 py-2.5 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-forest disabled:opacity-60";
const ghost =
  "flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-line disabled:opacity-40";
