"use client";

// Studio → Discover (Step 71). Matches what men see now on Social → Discover:
//   the Reels row at the top, reels inside the feed, and the "do this" cards.
// Here staff upload reels, pin or hide cards and reels, and set the mix:
//   - one reel after every N cards (3–12),
//   - let each man's habits move it (watchers a bit more reels, readers fewer; never more than 1 in 3),
//   - a new card order every visit, different for each man.
// Saved as app_settings "discover_config" (migration 0016); every change is in the audit log.
// Replaces the old Homepage editor (Featured insight, For you, Explore topics…), which men no longer see.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clapperboard, Eye, EyeOff, Pin, PinOff, RefreshCw, Search, Shuffle, Upload, Wand2 } from "lucide-react";
import { useStudio } from "@/components/admin/AdminShell";
import { Badge, Confirm, Empty, ErrorBox, Loading, PageHeader, Panel, btn, input, useLoad } from "@/components/admin/ui";
import { useToast } from "@/components/motion/Toast";
import { rpc, select } from "@/lib/admin/api";
import { actionOf } from "@/lib/content/actions";
import { DEFAULT_DISCOVER, normalizeDiscover, orderCards, orderReels, placeReels, REEL_EVERY_MAX, REEL_EVERY_MIN, reelEvery, type DiscoverConfig, type FeedCard } from "@/lib/content/discover";
import { isReel } from "@/lib/content/reels";
import type { ChallengeId, ContentItem } from "@/lib/content/types";
import { useLibrary } from "@/lib/content/useLibrary";

const CHALLENGE_LABEL: Record<ChallengeId, string> = {
  last: "Last longer",
  hard: "Stronger erections",
  her: "Satisfy her",
  mixes: "Natural mixes",
  train: "Exercises",
  reset: "Quit porn",
  desire: "Desire and round two",
};
type Stats = Record<string, { views: number; completes: number; saves: number }>;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export default function DiscoverStudioPage() {
  const studio = useStudio();
  const showToast = useToast();
  const { items, ready } = useLibrary();
  const canEdit = studio.can("homepage.publish");

  const saved = useLoad(async () => {
    const rows = await select<{ value: unknown }>("app_settings", "value", (q) => q.eq("key", "discover_config"));
    return normalizeDiscover(rows[0]?.value ?? DEFAULT_DISCOVER);
  }, []);
  const [work, setWork] = useState<DiscoverConfig | null>(null);
  useEffect(() => {
    if (saved.data) setWork(saved.data);
  }, [saved.data]);
  const cfg = work ?? DEFAULT_DISCOVER;
  const dirty = Boolean(saved.data && work && !same(saved.data, work));

  const stats = useLoad<Stats | null>(async () => {
    if (!studio.can("analytics.view")) return null;
    const from = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const rows = await select<{ content_id: string; views: number; completes: number; saves: number }>("content_stats_daily", "content_id,views,completes,saves", (q) => q.gte("day", from));
    const s: Stats = {};
    for (const r of rows) {
      const t = (s[r.content_id] ??= { views: 0, completes: 0, saves: 0 });
      t.views += r.views;
      t.completes += r.completes;
      t.saves += r.saves;
    }
    return s;
  }, [studio]);

  const cards = useMemo<FeedCard[]>(() => items.flatMap((item) => (actionOf(item) && item.status !== "archived" ? [{ item, spec: actionOf(item)! }] : [])), [items]);
  const reels = useMemo(() => items.filter(isReel), [items]);

  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (key: "pinned" | "hidden", id: string) =>
    setWork((w) => {
      const c = w ?? DEFAULT_DISCOVER;
      const has = c[key].includes(id);
      const next = { ...c, [key]: has ? c[key].filter((x) => x !== id) : [...c[key], id] };
      // Pinned and hidden can't both be true
      const other = key === "pinned" ? "hidden" : "pinned";
      if (!has) next[other] = next[other].filter((x) => x !== id);
      return next;
    });

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await rpc("settings_set", { p_key: "discover_config", p_value: cfg });
      showToast("Saved · men see it the next time they open Discover");
      setConfirm(false);
      saved.reload();
    } catch (e) {
      const m = (e as Error).message;
      setError(/unknown setting/i.test(m) ? "The database doesn't know these settings yet. Run supabase/migrations/0016_discover_settings.sql in Supabase → SQL Editor, then save again." : m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Discover"
        sub="What men see on Social → Discover: the Reels row, reels between the cards, and the “do this” cards. Upload reels, pin or hide things, and set how often reels come."
        actions={
          <div className="flex flex-wrap gap-2">
            {studio.can("content.edit") && (
              <Link href="/studio/edit?place=reels" className={btn.primary}>
                <Upload size={15} /> Upload a reel
              </Link>
            )}
            {studio.can("content.edit") && (
              <Link href="/studio/cards" className={btn.ghost}>
                <Wand2 size={15} /> Make a card
              </Link>
            )}
          </div>
        }
      />

      {saved.error && <ErrorBox error={saved.error} onRetry={saved.reload} />}
      {error && <ErrorBox error={error} />}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <FeedSettings cfg={cfg} canEdit={canEdit} onChange={setWork} />
          <ReelsPanel reels={reels} cfg={cfg} stats={stats.data} canEdit={canEdit} onToggle={toggle} />
          <CardsPanel cards={cards} cfg={cfg} stats={stats.data} canEdit={canEdit} onToggle={toggle} />
        </div>
        <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <OrderPreview cards={cards} reels={reels} cfg={cfg} ready={ready} />
          {canEdit && (
            <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
              <p className="text-sm font-semibold">{dirty ? "You have changes that men don't see yet." : "Everything here is live."}</p>
              <div className="mt-3 flex gap-2">
                <button className={btn.primary} disabled={!dirty || busy} onClick={() => setConfirm(true)}>
                  Save for everyone
                </button>
                <button className={btn.ghost} disabled={!dirty || busy} onClick={() => saved.data && setWork(saved.data)}>
                  Undo changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Confirm open={confirm} title="Save the Discover settings?" confirmLabel="Save" busy={busy} onClose={() => setConfirm(false)} onConfirm={save}>
        Every man gets them the next time he opens Discover. The change is written in the audit log.
      </Confirm>
    </div>
  );
}

/* ───────── The mix ───────── */
function FeedSettings({ cfg, canEdit, onChange }: { cfg: DiscoverConfig; canEdit: boolean; onChange: (c: DiscoverConfig) => void }) {
  const watcher = reelEvery(cfg, { reelViews: 80, reelFinished: 75, reelSkipped: 0, cardActions: 5 });
  const reader = reelEvery(cfg, { reelViews: 10, reelFinished: 0, reelSkipped: 9, cardActions: 80 });
  return (
    <Panel title="Feed mix" sub="How reels and cards are mixed on each man's Discover.">
      <div className="space-y-5">
        <label className="block">
          <span className="flex items-baseline justify-between text-sm font-semibold">
            <span>One reel after every</span>
            <span className="tabular-nums">{cfg.reelEvery} cards</span>
          </span>
          <input
            type="range"
            min={REEL_EVERY_MIN}
            max={REEL_EVERY_MAX}
            value={cfg.reelEvery}
            disabled={!canEdit}
            onChange={(e) => onChange({ ...cfg, reelEvery: Number(e.target.value) })}
            className="mt-2 w-full accent-forest"
          />
          <span className="flex justify-between text-[0.6875rem] text-ink-soft">
            <span>More reels (every {REEL_EVERY_MIN})</span>
            <span>More reading (every {REEL_EVERY_MAX})</span>
          </span>
        </label>
        <Switch
          on={cfg.adaptive}
          disabled={!canEdit}
          onChange={(v) => onChange({ ...cfg, adaptive: v })}
          title="Adapt to each man"
          about={`The app notices if he finishes reels or mostly reads and does the cards, and moves the mix for him: a man who watches gets a reel about every ${watcher} cards, a man who reads about every ${reader}. Never more than one reel per 3 cards. It needs a few visits before it changes anything, and it only matters once you have many reels.`}
        />
        <Switch
          on={cfg.shuffle}
          disabled={!canEdit}
          onChange={(v) => onChange({ ...cfg, shuffle: v })}
          title="New order every visit"
          about="Cards and reels come in a different order each time he opens Discover, and differ from man to man. Cards he hasn't opened, topics he follows and challenges he found useful come earlier. Pinned items stay first; cards he already did go last. Off = the same order for everyone."
        />
      </div>
    </Panel>
  );
}

function Switch({ on, disabled, onChange, title, about }: { on: boolean; disabled: boolean; onChange: (v: boolean) => void; title: string; about: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-soft">{about}</span>
      </span>
      <button
        role="switch"
        aria-checked={on}
        aria-label={title}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-forest" : "bg-line"}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}

/* ───────── Pin / hide buttons ───────── */
function PinHide({ id, cfg, canEdit, onToggle }: { id: string; cfg: DiscoverConfig; canEdit: boolean; onToggle: (k: "pinned" | "hidden", id: string) => void }) {
  const pinned = cfg.pinned.includes(id);
  const hidden = cfg.hidden.includes(id);
  return (
    <span className="flex shrink-0 gap-1">
      <button
        className={`${btn.small} ${pinned ? "bg-mint text-forest-deep" : ""}`}
        disabled={!canEdit}
        onClick={() => onToggle("pinned", id)}
        title={pinned ? "Unpin" : "Pin to the top of Discover"}
        aria-pressed={pinned}
      >
        {pinned ? <PinOff size={13} /> : <Pin size={13} />} {pinned ? "Pinned" : "Pin"}
      </button>
      <button className={`${btn.small} ${hidden ? "bg-red-50 text-red-700" : ""}`} disabled={!canEdit} onClick={() => onToggle("hidden", id)} title={hidden ? "Show again" : "Take off Discover"} aria-pressed={hidden}>
        {hidden ? <Eye size={13} /> : <EyeOff size={13} />} {hidden ? "Hidden" : "Hide"}
      </button>
    </span>
  );
}

const editHref = (c: ContentItem) => (c.builtIn ? `/social/c/${c.id}` : `/studio/edit?id=${encodeURIComponent(c.id)}`);

/* ───────── Reels ───────── */
function ReelsPanel({ reels, cfg, stats, canEdit, onToggle }: { reels: ContentItem[]; cfg: DiscoverConfig; stats: Stats | null | undefined; canEdit: boolean; onToggle: (k: "pinned" | "hidden", id: string) => void }) {
  return (
    <Panel
      title={`Reels (${reels.length})`}
      sub="Upright videos (9:16), best under 90 seconds. They show in the Reels row at the top of Discover and between the cards, and play full screen. “Do this” cards that have a video show here too."
    >
      {reels.length === 0 ? (
        <Empty title="No reels yet" action={<Link href="/studio/edit?place=reels" className={btn.primary}><Upload size={15} /> Upload your first reel</Link>}>
          Film it upright on a phone, keep it short, and write the title and caption in English and Kiswahili.
        </Empty>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {reels.map((r) => {
            const s = stats?.[r.id];
            return (
              <li key={r.id} className={`overflow-hidden rounded-2xl ring-1 ring-line ${cfg.hidden.includes(r.id) ? "opacity-50" : ""}`}>
                <Link href={editHref(r)} className="relative block aspect-[9/16] bg-forest-deep">
                  {r.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <video src={`${r.videoUrl}#t=0.5`} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                  {cfg.pinned.includes(r.id) && <span className="absolute left-2 top-2"><Badge tone="good">Pinned</Badge></span>}
                  <span className="absolute inset-x-2 bottom-2 line-clamp-3 text-xs font-semibold text-white">{r.title}</span>
                </Link>
                <div className="space-y-2 p-2">
                  <p className="text-[0.6875rem] text-ink-soft">{s ? `${s.views} views · ${s.views ? Math.round((s.completes / s.views) * 100) : 0}% finished · ${s.saves} saved` : "No views yet (30 days)"}</p>
                  <PinHide id={r.id} cfg={cfg} canEdit={canEdit} onToggle={onToggle} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* ───────── Cards ───────── */
function CardsPanel({ cards, cfg, stats, canEdit, onToggle }: { cards: FeedCard[]; cfg: DiscoverConfig; stats: Stats | null | undefined; canEdit: boolean; onToggle: (k: "pinned" | "hidden", id: string) => void }) {
  const [q, setQ] = useState("");
  const [ch, setCh] = useState<"all" | ChallengeId | "pinned" | "hidden" | "studio">("all");
  const shown = cards.filter((c) => {
    if (ch === "pinned" && !cfg.pinned.includes(c.item.id)) return false;
    if (ch === "hidden" && !cfg.hidden.includes(c.item.id)) return false;
    if (ch === "studio" && c.item.builtIn) return false;
    if (!["all", "pinned", "hidden", "studio"].includes(ch) && !c.spec.challenges.includes(ch as ChallengeId)) return false;
    const s = q.trim().toLowerCase();
    return !s || `${c.item.title} ${c.item.titleSw ?? ""}`.toLowerCase().includes(s);
  });
  return (
    <Panel
      title={`“Do this” cards (${cards.length})`}
      sub="The cards men swipe through on Discover. New ones come from Card maker. Pin one to put it at the top for everyone; hide one to take it off Discover (it still opens from links, search and Saved)."
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-xl bg-bg px-3 ring-1 ring-line">
          <Search size={14} className="text-ink-soft" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cards" aria-label="Search cards" className="w-full bg-transparent py-2 text-sm outline-none" />
        </label>
        <select value={ch} onChange={(e) => setCh(e.target.value as typeof ch)} className={`${input} w-auto`} aria-label="Filter">
          <option value="all">All cards</option>
          <option value="pinned">Pinned</option>
          <option value="hidden">Hidden</option>
          <option value="studio">Made in the Studio</option>
          {Object.entries(CHALLENGE_LABEL).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <ul className="divide-y divide-line">
        {shown.slice(0, 80).map((c) => {
          const s = stats?.[c.item.id];
          return (
            <li key={c.item.id} className={`flex items-center gap-3 py-2.5 ${cfg.hidden.includes(c.item.id) ? "opacity-50" : ""}`}>
              <div className="min-w-0 flex-1">
                <Link href={editHref(c.item)} className="block truncate text-sm font-semibold hover:underline">
                  {c.item.title}
                </Link>
                <p className="truncate text-[0.6875rem] text-ink-soft">
                  {c.spec.challenges.map((x) => CHALLENGE_LABEL[x]).join(" · ")} · {c.item.builtIn ? "built-in" : "Studio"}
                  {c.item.videoUrl ? " · has video (also a reel)" : ""}
                  {s ? ` · ${s.views} views, ${s.completes} did it` : ""}
                </p>
              </div>
              <PinHide id={c.item.id} cfg={cfg} canEdit={canEdit} onToggle={onToggle} />
            </li>
          );
        })}
        {shown.length === 0 && <li className="py-6 text-center text-sm text-ink-soft">No cards match.</li>}
        {shown.length > 80 && <li className="py-3 text-center text-xs text-ink-soft">Showing 80 of {shown.length}. Search to find others.</li>}
      </ul>
    </Panel>
  );
}

/* ───────── What a man sees first ───────── */
function OrderPreview({ cards, reels, cfg, ready }: { cards: FeedCard[]; reels: ContentItem[]; cfg: DiscoverConfig; ready: boolean }) {
  const [seed, setSeed] = useState("preview-1");
  const feed = useMemo(() => {
    const ordered = orderCards(cards, seed, { interests: [], opened: {}, liked: {}, done: {} }, cfg);
    const r = orderReels(reels, seed, {}, cfg);
    const spots = placeReels(ordered.length, r.length > 24 ? r.slice(12) : r, cfg.reelEvery);
    const out: { kind: "card" | "reel"; item: ContentItem }[] = [];
    ordered.slice(0, 18).forEach((c, i) => {
      const reel = spots.get(i);
      if (reel) out.push({ kind: "reel", item: reel });
      out.push({ kind: "card", item: c.item });
    });
    return { row: r.slice(0, 6), list: out };
  }, [cards, reels, cfg, seed]);
  if (!ready) return <Loading />;
  return (
    <Panel
      title="What a new man sees"
      sub="The top of Discover for one visit, with these settings. Every visit and every man gets a different order."
      actions={
        <button className={btn.small} onClick={() => setSeed(`preview-${Math.random().toString(36).slice(2, 7)}`)} title="Another visit">
          <Shuffle size={13} /> Another visit
        </button>
      }
    >
      {feed.row.length > 0 && (
        <p className="mb-2 text-xs text-ink-soft">
          <Clapperboard size={12} className="inline" /> Reels row: {feed.row.map((r) => r.title).join(" · ")}
        </p>
      )}
      <ol className="space-y-1.5 text-sm">
        {feed.list.map((x, i) => (
          <li key={`${x.kind}-${x.item.id}-${i}`} className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 ${x.kind === "reel" ? "bg-forest-deep text-white" : "bg-bg"}`}>
            <span className={`w-12 shrink-0 text-[0.625rem] font-bold uppercase tracking-wider ${x.kind === "reel" ? "text-mint" : "text-ink-soft"}`}>{x.kind === "reel" ? "Reel" : "Card"}</span>
            <span className="min-w-0 flex-1 truncate">{x.item.title}</span>
            {cfg.pinned.includes(x.item.id) && <Pin size={12} className="shrink-0" />}
          </li>
        ))}
      </ol>
      <p className="mt-3 flex items-center gap-1.5 text-[0.6875rem] text-ink-soft">
        <RefreshCw size={11} /> Late at night (22:00–05:00), reels stop after 3 with “that’s enough for tonight”; in the day after 15.
      </p>
    </Panel>
  );
}
