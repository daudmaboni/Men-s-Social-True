"use client";

// Studio → Homepage → Preview user page: the real Discover page on a full phone screen, working like the app.
// Shows the changes you're making on the Homepage editor (even unsaved), or what men see live now.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ErrorBox, Loading, PageHeader, Segmented, input, useLoad } from "@/components/admin/ui";
import PhonePreview from "@/components/admin/PhonePreview";
import { DiscoverView } from "@/components/social/Discover";
import { select } from "@/lib/admin/api";
import { TOPICS } from "@/lib/content/library";
import type { TopicId } from "@/lib/content/types";
import { useLibrary } from "@/lib/content/useLibrary";
import { DEFAULT_CONFIG, normalizeConfig } from "@/lib/homepage/config";
import { takeWork } from "@/lib/homepage/previewHandoff";
import { LangOverride } from "@/lib/i18n";

type Row = { id: number; state: "draft" | "published" | "archived"; config: unknown };

export default function HomepagePreviewPage() {
  const rows = useLoad(() => select<Row>("homepage_configs", "id,state,config", (q) => q.in("state", ["draft", "published"]).order("id", { ascending: false }).limit(5)), []);
  const { items: library } = useLibrary();
  const live = rows.data?.find((r) => r.state === "published") ?? null;
  const draft = rows.data?.find((r) => r.state === "draft") ?? null;
  const liveCfg = useMemo(() => (live ? normalizeConfig(live.config) : DEFAULT_CONFIG), [live]);
  const savedCfg = useMemo(() => (draft ? normalizeConfig(draft.config) : liveCfg), [draft, liveCfg]);
  // Unsaved changes from the editor, if you came from there
  const workCfg = useMemo(() => (rows.data ? takeWork(savedCfg) ?? savedCfg : null), [rows.data, savedCfg]);
  const unsaved = workCfg !== null && JSON.stringify(workCfg) !== JSON.stringify(savedCfg);

  const [showing, setShowing] = useState<"work" | "live">("work");
  const [as, setAs] = useState<"new" | TopicId>("new");
  const [lang, setLang] = useState<"en" | "sw">("en");

  if (rows.error) return <ErrorBox error={rows.error} onRetry={rows.reload} />;
  if (!rows.data || !workCfg) return <Loading />;

  const config = showing === "live" ? liveCfg : workCfg;
  const me = { interests: as === "new" ? [] : [as], bookmarks: {}, history: {} };
  const workLabel = unsaved ? "Your changes" : draft ? "Draft" : "Current";

  return (
    <div>
      <Link href="/studio/homepage" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-forest">
        <ArrowLeft size={16} /> Back to Homepage
      </Link>
      <PageHeader title="Preview user page" sub="The real Discover page on a phone. Scroll, swipe and open the topics like a man would; articles open in a new tab." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
        {/* Controls */}
        <div className="space-y-4 rounded-2xl bg-surface p-4 ring-1 ring-line lg:sticky lg:top-6">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-ink-soft">Show</p>
            <Segmented label="Show" value={showing} onChange={setShowing} options={[{ id: "work", label: workLabel }, { id: "live", label: "Live now" }]} />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-ink-soft">Language</p>
            <Segmented label="Preview language" value={lang} onChange={setLang} options={[{ id: "en", label: "EN" }, { id: "sw", label: "SW" }]} />
          </div>
          <label className="block space-y-1.5">
            <span className="block text-xs font-semibold text-ink-soft">Preview as</span>
            <select value={as} onChange={(e) => setAs(e.target.value as typeof as)} className={`${input} w-full py-2 text-sm`}>
              <option value="new">A new man (no topics yet)</option>
              {TOPICS.map((t) => (
                <option key={t.id} value={t.id}>
                  A man who follows {t.short}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[11px] text-ink-soft">For You still changes per man. {unsaved ? "Your changes aren't saved yet — go back and save a draft or publish." : ""}</p>
        </div>

        {/* The phone */}
        <PhonePreview reserve={170}>
          <LangOverride lang={lang}>
            <DiscoverView me={me} items={library} config={config} preview />
          </LangOverride>
        </PhonePreview>
      </div>
    </div>
  );
}
