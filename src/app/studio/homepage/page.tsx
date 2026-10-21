"use client";

// Admin → Homepage: control the men's Social → Discover page without an app update.
// Edit sections (order, visibility, words, picks) → see the real Discover preview → save draft → publish.
// The live layout is one row in homepage_configs; the app reads it. Earlier layouts can be restored.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp, ChevronDown, ChevronUp, Eye, EyeOff, History, Plus, RotateCcw, Search, Smartphone, X } from "lucide-react";
import { useStudio } from "@/components/admin/AdminShell";
import { Badge, Confirm, Drawer, ErrorBox, Loading, PageHeader, btn, fmtDate, input, useLoad } from "@/components/admin/ui";
import { clearWork, keepWork, takeWork } from "@/lib/homepage/previewHandoff";
import { useToast } from "@/components/motion/Toast";
import { rpc, select } from "@/lib/admin/api";
import { KIND_LABEL, SECTIONS } from "@/lib/content/select";
import type { ContentItem } from "@/lib/content/types";
import { useLibrary } from "@/lib/content/useLibrary";
import { DEFAULT_CONFIG, normalizeConfig, SECTION_INFO, type HomepageConfig, type SectionConfig, type SectionId } from "@/lib/homepage/config";
import type { PlaceId } from "@/lib/studio/places";

type Row = { id: number; state: "draft" | "published" | "archived"; config: unknown; note: string | null; created_at: string; published_at: string | null };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const PLACE_FOR: Record<SectionId, PlaceId> = { featured: "featured", for_you: "for-you", videos: "videos", question: "question", topics: "topics" };

export default function HomepagePage() {
  const studio = useStudio();
  const showToast = useToast();
  const rows = useLoad(() => select<Row>("homepage_configs", "id,state,config,note,created_at,published_at", (q) => q.order("id", { ascending: false }).limit(40)), []);
  const { items: library } = useLibrary();

  const live = rows.data?.find((r) => r.state === "published") ?? null;
  const draft = rows.data?.find((r) => r.state === "draft") ?? null;
  const history = (rows.data ?? []).filter((r) => r.state !== "draft");
  const liveCfg = useMemo(() => (live ? normalizeConfig(live.config) : DEFAULT_CONFIG), [live]);
  const savedCfg = useMemo(() => (draft ? normalizeConfig(draft.config) : liveCfg), [draft, liveCfg]);

  const [work, setWork] = useState<HomepageConfig | null>(null);
  useEffect(() => {
    // Coming back from the Preview page: pick up the changes you were making
    if (rows.data) setWork(takeWork(savedCfg) ?? savedCfg);
  }, [rows.data, savedCfg]);

  const [open, setOpen] = useState<SectionId | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [note, setNote] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  // Warn before leaving with changes that aren't even saved as a draft
  const unsaved = work !== null && !same(work, savedCfg);
  // Keep unsaved changes for the Preview page (this browser tab only)
  useEffect(() => {
    if (!work) return;
    if (unsaved) keepWork(work, savedCfg);
    else clearWork();
  }, [work, unsaved, savedCfg]);
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  if (rows.error) return <ErrorBox error={rows.error} onRetry={rows.reload} />;
  if (!rows.data || !work) return <Loading />;

  const canPublish = studio.can("homepage.publish");
  const differsFromLive = !same(work, liveCfg);
  const setSection = (id: SectionId, patch: Partial<SectionConfig>) =>
    setWork((w) => w && { ...w, sections: w.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const move = (i: number, d: -1 | 1) =>
    setWork((w) => {
      if (!w) return w;
      const s = [...w.sections];
      const j = i + d;
      if (j < 0 || j >= s.length) return w;
      [s[i], s[j]] = [s[j], s[i]];
      return { ...w, sections: s };
    });

  async function act(name: string, fn: () => Promise<unknown>, done: string) {
    setBusy(name);
    setError(null);
    try {
      await fn();
      showToast(done);
      rows.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const saveDraft = () => act("save", () => rpc("homepage_save_draft", { p_config: work }), "Draft saved");
  const publish = async () => {
    setPublishing(false);
    await act(
      "publish",
      async () => {
        if (!same(work, draft ? normalizeConfig(draft.config) : null)) await rpc("homepage_save_draft", { p_config: work });
        await rpc("homepage_publish", { p_note: note.trim() || null });
      },
      "Published · men see the new Discover page",
    );
    setNote("");
  };
  const discard = async () => {
    setDiscarding(false);
    await act("discard", () => rpc("homepage_discard_draft"), "Draft discarded");
    setWork(liveCfg);
  };


  return (
    <div>
      <PageHeader
        title="Homepage"
        sub="Since Step 60, men see a feed of “do this” cards on Social → Discover (src/lib/content/actions.ts). This older section layout is kept for reference and is not shown to men."
        actions={
          <>
            <button onClick={() => setShowHistory(true)} className={btn.ghost}>
              <History size={15} /> History
            </button>
            {draft && (
              <button onClick={() => setDiscarding(true)} disabled={!!busy} className={btn.ghost}>
                Discard draft
              </button>
            )}
            <button onClick={saveDraft} disabled={!!busy || !unsaved} className={btn.ghost}>
              {busy === "save" ? "Saving…" : "Save draft"}
            </button>
            {canPublish && (
              <button onClick={() => setPublishing(true)} disabled={!!busy || !differsFromLive} className={btn.primary}>
                {busy === "publish" ? "Publishing…" : "Publish"}
              </button>
            )}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
        {live ? <Badge tone="good">Live since {fmtDate(live.published_at, true)}</Badge> : <Badge>Live: the standard Discover page (nothing published yet)</Badge>}
        {draft && <Badge tone="warn">Draft saved {fmtDate(draft.created_at, true)} · not live yet</Badge>}
        {unsaved && <Badge tone="info">Unsaved changes</Badge>}
        {!differsFromLive && !unsaved && <Badge>Same as live</Badge>}
        {!canPublish && <span className="text-ink-soft">Your role can save drafts; an editor or owner publishes.</span>}
      </div>

      {error && (
        <div className="mb-5">
          <ErrorBox error={error} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Sections */}
        <ol className="space-y-3" aria-label="Discover sections, in order">
          {work.sections.map((s, i) => {
            const info = SECTION_INFO[s.id];
            const changed = !same(s, liveCfg.sections.find((x) => x.id === s.id)) || liveCfg.sections.findIndex((x) => x.id === s.id) !== i;
            const expanded = open === s.id;
            return (
              <li key={s.id} className={`rounded-2xl bg-surface ring-1 ${changed ? "ring-amber-300" : "ring-line"}`}>
                <div className="flex items-center gap-2 p-3">
                  <div className="flex flex-col">
                    <button aria-label={`Move ${info.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-0.5 text-ink-soft hover:bg-bg disabled:opacity-25">
                      <ArrowUp size={14} />
                    </button>
                    <button aria-label={`Move ${info.name} down`} disabled={i === work.sections.length - 1} onClick={() => move(i, 1)} className="rounded p-0.5 text-ink-soft hover:bg-bg disabled:opacity-25">
                      <ArrowDown size={14} />
                    </button>
                  </div>
                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(expanded ? null : s.id)} aria-expanded={expanded}>
                    <p className={`flex items-center gap-2 text-sm font-bold ${s.visible ? "" : "text-ink-soft line-through"}`}>
                      {i + 1}. {s.title?.en || info.name}
                      {changed && <Badge tone="warn">Changed</Badge>}
                    </p>
                    <p className="truncate text-xs text-ink-soft">{summary(s)}</p>
                  </button>
                  <button
                    onClick={() => setSection(s.id, { visible: !s.visible })}
                    aria-pressed={!s.visible}
                    aria-label={s.visible ? `Hide ${info.name}` : `Show ${info.name}`}
                    className={btn.small}
                  >
                    {s.visible ? <Eye size={13} /> : <EyeOff size={13} />} {s.visible ? "Shown" : "Hidden"}
                  </button>
                  <button onClick={() => setOpen(expanded ? null : s.id)} aria-label={expanded ? "Close" : "Edit"} className="p-1 text-ink-soft">
                    {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
                {expanded && <SectionEditor section={s} library={library} onChange={(p) => setSection(s.id, p)} />}
              </li>
            );
          })}
        </ol>

        {/* The phone preview has its own page; here, a card that opens it */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Link
            href="/studio/homepage/preview"
            className="group flex items-center gap-4 rounded-2xl bg-surface p-4 ring-1 ring-line transition-colors hover:ring-forest lg:flex-col lg:items-stretch lg:p-5"
          >
            {/* A tiny phone */}
            <span className="flex h-24 w-14 shrink-0 flex-col gap-1 rounded-[14px] border-4 border-ink/80 bg-bg p-1 lg:mx-auto lg:h-40 lg:w-[88px] lg:rounded-[20px] lg:p-1.5" aria-hidden>
              <span className="h-1/3 rounded-md bg-forest" />
              <span className="h-2 rounded bg-line" />
              <span className="h-2 w-2/3 rounded bg-line" />
              <span className="flex-1 rounded-md bg-mint" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-bold">
                <Smartphone size={16} className="text-forest" /> Preview user page
              </span>
              <span className="mt-1 block text-xs text-ink-soft">
                See Discover on a full phone screen and try it like a man would: scroll, swipe, open topics.
              </span>
              {unsaved && <span className="mt-2 inline-block"><Badge tone="info">Shows your unsaved changes</Badge></span>}
              <span className="mt-3 flex items-center gap-1 text-sm font-semibold text-forest">
                Open preview <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
          </Link>
        </aside>
      </div>

      <Confirm
        open={publishing}
        title="Publish this Discover page?"
        confirmLabel="Publish"
        busy={busy === "publish"}
        onConfirm={publish}
        onClose={() => setPublishing(false)}
      >
        <p>Every man sees it the next time he opens Discover. You can restore the current version later from History.</p>
        <label className="mt-3 block text-xs">
          What changed? (optional, for History)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={`${input} mt-1`} placeholder="e.g. New sleep series featured" />
        </label>
      </Confirm>
      <Confirm open={discarding} title="Discard the draft?" confirmLabel="Discard" danger onConfirm={discard} onClose={() => setDiscarding(false)}>
        The saved draft is deleted and the editor goes back to what&apos;s live. The live page doesn&apos;t change.
      </Confirm>

      <Drawer open={showHistory} title="Published versions" onClose={() => setShowHistory(false)}>
        {history.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing published yet. The app shows the standard Discover page.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((r) => (
              <li key={r.id} className="rounded-xl p-3 ring-1 ring-line">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {fmtDate(r.published_at, true)} {r.state === "published" && <Badge tone="good">Live</Badge>}
                    </p>
                    {r.note && <p className="text-xs text-ink-soft">{r.note}</p>}
                    <p className="mt-1 text-[0.6875rem] text-ink-soft">
                      {normalizeConfig(r.config)
                        .sections.filter((s) => s.visible)
                        .map((s) => SECTION_INFO[s.id].name)
                        .join(" → ")}
                    </p>
                  </div>
                  {r.state !== "published" && (
                    <button
                      className={btn.small}
                      disabled={!!busy}
                      onClick={() =>
                        act("restore", () => rpc("homepage_restore", { p_id: r.id }), "Loaded as a draft · check it and publish").then(() => setShowHistory(false))
                      }
                    >
                      <RotateCcw size={12} /> Restore as draft
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </div>
  );

  function summary(s: SectionConfig) {
    const parts: string[] = [];
    if (!s.visible) parts.push("Hidden from men");
    if (s.items?.length) parts.push(`${s.items.length} ${s.id === "topics" ? "tiles chosen" : s.items.length === 1 ? "pick" : "picks"}`);
    else parts.push(s.id === "topics" ? "All topic tiles" : "Chosen automatically");
    if (s.count) parts.push(`show ${s.count}`);
    if (s.title?.en || s.title?.sw) parts.push("custom title");
    return parts.join(" · ");
  }
}

function SectionEditor({ section: s, library, onChange }: { section: SectionConfig; library: ContentItem[]; onChange: (p: Partial<SectionConfig>) => void }) {
  const info = SECTION_INFO[s.id];
  const [q, setQ] = useState("");
  const allowed = library.filter((c) => !info.kinds || info.kinds.includes(c.kind));
  const chosen = (s.items ?? []).map((id) => library.find((c) => c.id === id) ?? null);
  const matches = q.trim().length < 2 ? [] : allowed.filter((c) => !s.items?.includes(c.id) && `${c.title} ${c.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const setItems = (items: string[]) => onChange({ items: items.length ? items : undefined });
  const words = (key: "title" | "subtitle", lang: "en" | "sw", v: string) => {
    const next = { ...(s[key] ?? {}), [lang]: v || undefined };
    onChange({ [key]: next.en || next.sw ? next : undefined });
  };

  return (
    <div className="space-y-4 border-t border-line p-4">
      <p className="text-xs text-ink-soft">{info.what}</p>

      {s.id !== "featured" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-ink-soft">
            Title (English)
            <input value={s.title?.en ?? ""} onChange={(e) => words("title", "en", e.target.value)} placeholder={info.name} maxLength={60} className={`${input} mt-1 font-normal text-ink`} />
          </label>
          <label className="text-xs font-semibold text-ink-soft">
            Title (Kiswahili)
            <input value={s.title?.sw ?? ""} onChange={(e) => words("title", "sw", e.target.value)} placeholder="Uses the app's translation" maxLength={60} className={`${input} mt-1 font-normal text-ink`} lang="sw" />
          </label>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-ink-soft">
          {s.id === "featured" ? "Line under the card (English)" : "Description (English)"}
          <input value={s.subtitle?.en ?? ""} onChange={(e) => words("subtitle", "en", e.target.value)} placeholder="Automatic" maxLength={120} className={`${input} mt-1 font-normal text-ink`} />
        </label>
        <label className="text-xs font-semibold text-ink-soft">
          {s.id === "featured" ? "Line under the card (Kiswahili)" : "Description (Kiswahili)"}
          <input value={s.subtitle?.sw ?? ""} onChange={(e) => words("subtitle", "sw", e.target.value)} placeholder="Automatic" maxLength={120} className={`${input} mt-1 font-normal text-ink`} lang="sw" />
        </label>
      </div>

      {info.countRange && (
        <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
          How many to show
          <select value={s.count ?? info.defaultCount} onChange={(e) => onChange({ count: Number(e.target.value) })} className={`${input} w-20 py-1.5`}>
            {Array.from({ length: info.countRange[1] - info.countRange[0] + 1 }, (_, i) => i + info.countRange![0]).map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      )}

      {s.id === "topics" ? (
        <fieldset>
          <legend className="text-xs font-semibold text-ink-soft">Tiles to show (empty = all, in the normal order)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {SECTIONS.map((sec) => {
              const on = s.items?.includes(sec.id) ?? false;
              return (
                <button
                  key={sec.id}
                  aria-pressed={on}
                  onClick={() => setItems(on ? (s.items ?? []).filter((x) => x !== sec.id) : [...(s.items ?? []), sec.id])}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${on ? "bg-forest-deep text-white" : "bg-bg text-ink-soft ring-1 ring-line"}`}
                >
                  {on && `${(s.items ?? []).indexOf(sec.id) + 1}. `}
                  {sec.title}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[0.6875rem] text-ink-soft">Tiles show in the order you tap them.</p>
        </fieldset>
      ) : (
        <div>
          <p className="text-xs font-semibold text-ink-soft">{s.id === "for_you" ? "Editor picks (shown first)" : "Picks"}</p>
          {chosen.length === 0 ? (
            <p className="mt-1 text-xs text-ink-soft">None — chosen automatically for each man.</p>
          ) : (
            <ol className="mt-2 space-y-1.5">
              {chosen.map((c, i) => (
                <li key={s.items![i]} className="flex items-center gap-2 rounded-xl bg-bg px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {c ? c.title : <span className="text-red-700">Not live any more: {s.items![i]} (ignored)</span>}
                    {c && <span className="ml-1 text-[0.6875rem] text-ink-soft">· {KIND_LABEL[c.kind]}</span>}
                  </span>
                  <button aria-label="Move up" disabled={i === 0} onClick={() => setItems(swap(s.items!, i, i - 1))} className="text-ink-soft disabled:opacity-25">
                    <ArrowUp size={13} />
                  </button>
                  <button aria-label="Move down" disabled={i === chosen.length - 1} onClick={() => setItems(swap(s.items!, i, i + 1))} className="text-ink-soft disabled:opacity-25">
                    <ArrowDown size={13} />
                  </button>
                  <button aria-label={`Remove ${c?.title ?? "item"}`} onClick={() => setItems(s.items!.filter((_, j) => j !== i))} className="text-ink-soft">
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ol>
          )}
          <label className="mt-2 flex items-center gap-2 rounded-xl bg-bg px-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-forest">
            <Search size={14} className="text-ink-soft" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Add live ${info.kinds?.map((k) => KIND_LABEL[k as keyof typeof KIND_LABEL].toLowerCase()).join(", ")}…`} className="w-full bg-transparent py-2 text-sm outline-none" aria-label={`Search content to add to ${info.name}`} />
          </label>
          {matches.length > 0 && (
            <ul className="mt-1 overflow-hidden rounded-xl ring-1 ring-line">
              {matches.map((c) => (
                <li key={c.id}>
                  <button onClick={() => (setItems([...(s.items ?? []), c.id]), setQ(""))} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg">
                    <Plus size={13} className="text-forest" /> <span className="truncate">{c.title}</span>
                    <span className="ml-auto shrink-0 text-[0.6875rem] text-ink-soft">{KIND_LABEL[c.kind]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.trim().length >= 2 && matches.length === 0 && <p className="mt-1 text-xs text-ink-soft">No live content matches. Only published items can be placed here.</p>}
          <Link href={`/studio/edit?place=${PLACE_FOR[s.id]}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-forest">
            <Plus size={13} /> Write new content for this section
          </Link>
        </div>
      )}
    </div>
  );
}

const swap = (a: string[], i: number, j: number) => {
  const b = [...a];
  [b[i], b[j]] = [b[j], b[i]];
  return b;
};

