"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Download, Droplet, EyeOff, Globe, Moon, ShieldCheck, Stethoscope, Trash2, UserPlus } from "lucide-react";
import Sheet from "@/components/motion/Sheet";
import { useToast } from "@/components/motion/Toast";
import InterestsSheet from "@/components/social/InterestsSheet";
import { TOPICS } from "@/lib/content/library";
import type { TopicId } from "@/lib/content/types";
import { feedStore } from "@/lib/feed/store";
import { deleteMyData, exportMyData } from "@/lib/me/data";
import { setLang, type Lang } from "@/lib/me/lang";
import { progressStore } from "@/lib/progress/store";

/* ───────── Goals and topics ───────── */
export function GoalsCard({ water, sleep, interests }: { water: number | null; sleep: number | null; interests: TopicId[] }) {
  const showToast = useToast();
  const [edit, setEdit] = useState<"water" | "sleep" | null>(null);
  const [value, setValue] = useState(0);
  const [topics, setTopics] = useState(false);

  const open = (m: "water" | "sleep") => {
    setValue(m === "water" ? (water ?? 2500) : (sleep ?? 420));
    setEdit(m);
  };
  const step = edit === "water" ? 250 : 30;
  const [min, max] = edit === "water" ? [500, 5000] : [240, 720];
  const fmt = (m: "water" | "sleep", v: number) => (m === "water" ? `${(v / 1000).toFixed(v % 1000 ? 2 : 1).replace(/0$/, "")} L` : `${Math.floor(v / 60)}h${v % 60 ? ` ${v % 60}m` : ""}`);

  function save() {
    if (!edit) return;
    progressStore.setGoal(edit, value, edit === "water" ? "ml" : "min");
    showToast(`${edit === "water" ? "Water" : "Sleep"} goal: ${fmt(edit, value)}`);
    setEdit(null);
  }

  return (
    <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
      <h2 className="text-lg font-bold">My goals</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button onClick={() => open("water")} className="rounded-2xl bg-bg p-4 text-left ring-1 ring-line">
          <Droplet size={18} className="text-forest" />
          <p className="mt-2 text-xl font-bold">{water ? fmt("water", water) : "Not set"}</p>
          <p className="text-xs text-ink-soft">water a day</p>
        </button>
        <button onClick={() => open("sleep")} className="rounded-2xl bg-bg p-4 text-left ring-1 ring-line">
          <Moon size={18} className="text-forest" />
          <p className="mt-2 text-xl font-bold">{sleep ? fmt("sleep", sleep) : "Not set"}</p>
          <p className="text-xs text-ink-soft">sleep a night</p>
        </button>
      </div>

      <button onClick={() => setTopics(true)} className="mt-3 flex w-full items-center justify-between rounded-2xl bg-mint/60 px-4 py-3 text-left">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-forest-deep">Topics I follow</span>
          <span className="block truncate text-xs text-forest">
            {interests.length ? TOPICS.filter((t) => interests.includes(t.id)).map((t) => t.short).join(" · ") : "None yet. Choose what matters to you."}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-forest" />
      </button>

      <Sheet open={edit !== null} onClose={() => setEdit(null)} title={edit === "water" ? "Daily water goal" : "Nightly sleep goal"}>
        {edit && (
          <>
            <div className="flex items-center justify-between gap-3">
              <button aria-label="Less" onClick={() => setValue((v) => Math.max(min, v - step))} className="h-12 w-12 rounded-full bg-bg text-2xl font-bold ring-1 ring-line">
                −
              </button>
              <p className="text-3xl font-bold" aria-live="polite">
                {fmt(edit, value)}
              </p>
              <button aria-label="More" onClick={() => setValue((v) => Math.min(max, v + step))} className="h-12 w-12 rounded-full bg-bg text-2xl font-bold ring-1 ring-line">
                +
              </button>
            </div>
            <p className="mt-3 text-xs text-ink-soft">
              {edit === "water"
                ? "Most men do well with about 2 to 3 litres a day, more in heat or after exercise."
                : "Most adults need 7 to 9 hours. Pick a goal you can really keep."}
            </p>
            <button onClick={save} className="mt-4 w-full rounded-full bg-forest py-3 text-sm font-semibold text-white">
              Save goal
            </button>
          </>
        )}
      </Sheet>
      <InterestsSheet open={topics} onClose={() => setTopics(false)} current={interests} />
    </section>
  );
}

/* ───────── App settings ───────── */
export function SettingsCard({ lang, discreet }: { lang: Lang; discreet: boolean }) {
  const showToast = useToast();
  return (
    <section className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-3 p-5">
        <Globe size={18} className="shrink-0 text-forest" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Language</p>
          <p className="text-xs text-ink-soft">Guides open in this language when there&apos;s a Kiswahili version.</p>
        </div>
        <div className="inline-flex shrink-0 rounded-full bg-bg p-1 text-xs font-semibold ring-1 ring-line" role="radiogroup" aria-label="Language">
          {(["en", "sw"] as const).map((l) => (
            <button
              key={l}
              role="radio"
              aria-checked={lang === l}
              onClick={() => {
                setLang(l);
                showToast(l === "sw" ? "Kiswahili imechaguliwa" : "English selected");
              }}
              className={`rounded-full px-3 py-1.5 ${lang === l ? "bg-forest text-white" : "text-ink-soft"}`}
            >
              {l === "en" ? "EN" : "SW"}
            </button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3 p-5">
        <EyeOff size={18} className="shrink-0 text-forest" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Discreet mode</span>
          <span className="block text-xs text-ink-soft">
            Uses neutral wording on the Man tab, so private topics don&apos;t show if someone looks at your screen.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={discreet}
          onChange={(e) => {
            feedStore.setDiscreet(e.target.checked);
            showToast(e.target.checked ? "Discreet mode on" : "Discreet mode off");
          }}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className="relative h-7 w-12 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-forest peer-focus-visible:ring-2 peer-focus-visible:ring-forest after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
        />
      </label>
    </section>
  );
}

/* ───────── Account, privacy and help ───────── */
export function PrivacyCard() {
  const showToast = useToast();
  const [confirm, setConfirm] = useState(false);

  function download() {
    try {
      const data = exportMyData(localStorage);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mens-social-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Your data is downloading");
    } catch {
      showToast("Couldn't download on this browser");
    }
  }

  function removeAll() {
    try {
      deleteMyData(localStorage);
    } catch {}
    // Reload so every screen starts fresh
    window.location.href = "/";
  }

  return (
    <>
      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
        <div className="flex gap-3">
          <UserPlus size={18} className="mt-0.5 shrink-0 text-forest" />
          <div>
            <p className="font-semibold">Account</p>
            <p className="mt-1 text-sm text-ink-soft">
              You&apos;re using Men&apos;s Social as a guest. Everything is saved on this phone only. Accounts are coming soon, so
              you can change phones without losing your progress.
            </p>
          </div>
        </div>
      </section>

      <section className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
        <div className="flex gap-3 p-5">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-forest" />
          <div>
            <p className="font-semibold">Your privacy</p>
            <p className="mt-1 text-sm text-ink-soft">
              Your check-ins, sleep, water and notes stay on this phone. We never use them for adverts and never ask for intimate
              photos.
            </p>
          </div>
        </div>
        <button onClick={download} className="flex w-full items-center gap-3 p-5 text-left">
          <Download size={18} className="shrink-0 text-forest" />
          <span className="flex-1 font-semibold">Download my data</span>
          <ChevronRight size={16} className="text-ink-soft" />
        </button>
        <button onClick={() => setConfirm(true)} className="flex w-full items-center gap-3 p-5 text-left text-red-700">
          <Trash2 size={18} className="shrink-0" />
          <span className="flex-1 font-semibold">Delete all my data</span>
          <ChevronRight size={16} />
        </button>
      </section>

      <section className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
        <Link href="/social/c/tool-doctor-check" className="flex items-center gap-3 p-5">
          <Stethoscope size={18} className="shrink-0 text-forest" />
          <span className="flex-1">
            <span className="block font-semibold">Should I see a doctor?</span>
            <span className="block text-xs text-ink-soft">A quick check of signs that need a professional.</span>
          </span>
          <ChevronRight size={16} className="text-ink-soft" />
        </Link>
        <p className="p-5 text-xs leading-relaxed text-ink-soft">
          Men&apos;s Social gives general education, not medical advice. It doesn&apos;t diagnose or treat any condition. If
          something worries you, or symptoms last or get worse, please see a qualified health professional.
        </p>
      </section>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Delete everything?">
        <p className="text-sm text-ink-soft">
          This removes your points, badges, check-ins, sleep and water records, saved guides and posts from this phone. It
          can&apos;t be undone.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => setConfirm(false)} className="rounded-full py-3 text-sm font-semibold ring-1 ring-line">
            Keep my data
          </button>
          <button onClick={removeAll} className="rounded-full bg-red-700 py-3 text-sm font-semibold text-white">
            Delete
          </button>
        </div>
      </Sheet>
    </>
  );
}
