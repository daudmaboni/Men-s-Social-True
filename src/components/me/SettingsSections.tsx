"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, CloudDownload, Download, Droplet, EyeOff, Globe, HeartHandshake, Moon, MoonStar, ShieldCheck, Stethoscope, Trash2 } from "lucide-react";
import { ACCENTS, setAccent, setThemePref, useAccent, useThemePref, type ThemePref } from "@/lib/theme";
import Sheet from "@/components/motion/Sheet";
import { useToast } from "@/components/motion/Toast";
import InterestsSheet from "@/components/social/InterestsSheet";
import { TOPICS } from "@/lib/content/library";
import type { TopicId } from "@/lib/content/types";
import { feedStore } from "@/lib/feed/store";
import { deleteMyData, exportMyData } from "@/lib/me/data";
import { setLang, type Lang } from "@/lib/me/lang";
import { progressStore } from "@/lib/progress/store";
import AccountCard from "@/components/account/AccountCard";
import type { AccountState } from "@/lib/account/useAccount";
import { deleteCloudData, stopSync } from "@/lib/account/sync";
import { useSupportShare } from "@/lib/account/share";
import { useT } from "@/lib/i18n";
import FoldRow from "@/components/motion/FoldRow";
import { FontStylePicker, TextSizePicker } from "@/components/me/FontChoices";
import { TEXT_SIZES, fontById, useFont, useTextSize } from "@/lib/fonts";

/* ───────── Goals and topics ───────── */
export function GoalsCard({ water, sleep, interests }: { water: number | null; sleep: number | null; interests: TopicId[] }) {
  const showToast = useToast();
  const t = useT();
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
    showToast(`${t(edit === "water" ? "Water goal" : "Sleep goal")}: ${fmt(edit, value)}`);
    setEdit(null);
  }

  return (
    <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
      <h2 className="text-lg font-bold">{t("My goals")}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button onClick={() => open("water")} className="rounded-2xl bg-bg p-4 text-left ring-1 ring-line">
          <Droplet size={18} className="text-forest" />
          <p className="mt-2 text-xl font-bold">{water ? fmt("water", water) : t("Not set")}</p>
          <p className="text-xs text-ink-soft">{t("water a day")}</p>
        </button>
        <button onClick={() => open("sleep")} className="rounded-2xl bg-bg p-4 text-left ring-1 ring-line">
          <Moon size={18} className="text-forest" />
          <p className="mt-2 text-xl font-bold">{sleep ? fmt("sleep", sleep) : t("Not set")}</p>
          <p className="text-xs text-ink-soft">{t("sleep a night")}</p>
        </button>
      </div>

      <button onClick={() => setTopics(true)} className="mt-3 flex w-full items-center justify-between rounded-2xl bg-mint/60 px-4 py-3 text-left">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-forest-deep">{t("Topics I follow")}</span>
          <span className="block truncate text-xs text-forest">
            {interests.length ? TOPICS.filter((x) => interests.includes(x.id)).map((x) => t(x.short)).join(" · ") : t("None yet. Choose what matters to you.")}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-forest" />
      </button>

      <Sheet open={edit !== null} onClose={() => setEdit(null)} title={t(edit === "water" ? "Daily water goal" : "Nightly sleep goal")}>
        {edit && (
          <>
            <div className="flex items-center justify-between gap-3">
              <button aria-label={t("Less")} onClick={() => setValue((v) => Math.max(min, v - step))} className="h-12 w-12 rounded-full bg-bg text-2xl font-bold ring-1 ring-line">
                −
              </button>
              <p className="text-3xl font-bold" aria-live="polite">
                {fmt(edit, value)}
              </p>
              <button aria-label={t("More")} onClick={() => setValue((v) => Math.min(max, v + step))} className="h-12 w-12 rounded-full bg-bg text-2xl font-bold ring-1 ring-line">
                +
              </button>
            </div>
            <p className="mt-3 text-xs text-ink-soft">
              {t(
                edit === "water"
                  ? "Most men do well with about 2 to 3 litres a day, more in heat or after exercise."
                  : "Most adults need 7 to 9 hours. Pick a goal you can really keep.",
              )}
            </p>
            <button onClick={save} className="mt-4 w-full rounded-full bg-forest py-3 text-sm font-semibold text-white">
              {t("Save goal")}
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
  const theme = useThemePref();
  const accent = useAccent();
  const t = useT();
  const font = fontById(useFont("app"));
  const size = useTextSize("app");
  const fontName = font.id === "kayani" || font.id === "system" ? t(font.name) : font.name;
  const sizeName = TEXT_SIZES.find((z) => z.id === size)?.heading ?? "Normal";
  return (
    <section className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
      <FoldRow
        icon={<MoonStar size={18} className="shrink-0 text-forest" />}
        title={t("Appearance")}
        sub={[t(theme === "light" ? "Light" : theme === "dark" ? "Dark" : "Auto"), t(ACCENTS.find((a) => a.id === accent)?.label ?? "Green"), fontName, t(sizeName)].join(" · ")}
        showMore={t("Show more")}
        showLess={t("Show less")}
      >
        <p className="mb-3 text-xs text-ink-soft">{t("Tip: spread two fingers apart for dark, pinch them together for light.")}</p>
        <div className="grid grid-cols-3 rounded-full bg-bg p-1 text-xs font-semibold ring-1 ring-line" role="radiogroup" aria-label={t("Appearance")}>
          {(["light", "dark", "auto"] as ThemePref[]).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={theme === m}
              onClick={(e) => setThemePref(m, { x: e.clientX, y: e.clientY })}
              className={`rounded-full py-2 ${theme === m ? "bg-forest text-white" : "text-ink-soft"}`}
            >
              {t(m === "light" ? "Light" : m === "dark" ? "Dark" : "Auto")}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs font-semibold text-ink-soft">{t("Colour")}</p>
        <div className="mt-2 flex gap-3" role="radiogroup" aria-label={t("Colour")}>
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              role="radio"
              aria-checked={accent === a.id}
              onClick={(e) => {
                setAccent(a.id, { x: e.clientX, y: e.clientY });
                showToast(t("{name} colour", { name: t(a.label) }));
              }}
              className={`flex flex-1 flex-col items-center gap-1.5 rounded-2xl py-2.5 text-xs font-semibold ring-1 transition-colors ${
                accent === a.id ? "bg-bg text-ink ring-forest" : "text-ink-soft ring-line"
              }`}
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full shadow-inner"
                style={{ background: `linear-gradient(135deg, ${a.swatch}, ${a.swatch}cc)` }}
              >
                {accent === a.id && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
              </span>
              {t(a.label)}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <FontStylePicker scope="app" t={t} onPicked={(name) => showToast(t("Font: {name}", { name }))} />
        </div>
        <div className="mt-4">
          <TextSizePicker scope="app" t={t} />
        </div>
      </FoldRow>
      <div className="flex items-center gap-3 p-5">
        <Globe size={18} className="shrink-0 text-forest" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t("Language")}</p>
          <p className="text-xs text-ink-soft">{t("The whole app, and guides that have a Kiswahili version.")}</p>
        </div>
        <div className="inline-flex shrink-0 rounded-full bg-bg p-1 text-xs font-semibold ring-1 ring-line" role="radiogroup" aria-label={t("Language")}>
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
          <span className="block font-semibold">{t("Discreet mode")}</span>
          <span className="block text-xs text-ink-soft">
            {t("Uses neutral wording on the Man tab, so private topics don't show if someone looks at your screen.")}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={discreet}
          onChange={(e) => {
            feedStore.setDiscreet(e.target.checked);
            showToast(t(e.target.checked ? "Discreet mode on" : "Discreet mode off"));
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
export function PrivacyCard({ acc }: { acc: AccountState }) {
  const signedIn = acc.status === "signedIn";
  const showToast = useToast();
  const t = useT();
  const [confirm, setConfirm] = useState(false);
  const share = useSupportShare(signedIn ? acc.user.id : null);
  const [shareBusy, setShareBusy] = useState(false);

  async function toggleShare(on: boolean) {
    setShareBusy(true);
    try {
      await share.set(on);
      showToast(t(on ? "Kayani support can now see your records" : "Your records are private again"));
    } catch {
      showToast(t("Couldn't change it. Check your internet."));
    } finally {
      setShareBusy(false);
    }
  }

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
      showToast(t("Your data is downloading"));
    } catch {
      showToast(t("Couldn't download on this browser"));
    }
  }

  async function removeAll() {
    if (signedIn) {
      stopSync({ clearPhone: false });
      try {
        await deleteCloudData(acc.user.id);
      } catch {
        showToast(t("Couldn't delete from your account. Check your internet."));
        return;
      }
    }
    try {
      deleteMyData(localStorage);
    } catch {}
    // Reload so every screen starts fresh
    window.location.href = "/";
  }

  return (
    <>
      <AccountCard acc={acc} />

      <section className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
        <div className="flex gap-3 p-5">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-forest" />
          <div>
            <p className="font-semibold">{t("Your privacy")}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {t(
                signedIn
                  ? share.sharedAt
                    ? "Your check-ins, sleep, water and notes are saved privately in your account. You're sharing them with Kayani support (see below)."
                    : "Your check-ins, sleep, water and notes are saved privately in your account. Only you can see them, not even Kayani staff."
                  : "Your check-ins, sleep, water and notes stay on this phone.",
              )}{" "}
              {t("We never use them for adverts and never ask for intimate photos.")}
            </p>
          </div>
        </div>
        {signedIn && share.ready && share.available && (
          <label className="flex cursor-pointer items-center gap-3 p-5">
            <HeartHandshake size={18} className="shrink-0 text-forest" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t("Share my records with Kayani support")}</span>
              <span className="block text-xs text-ink-soft">
                {t("Turn on only if you want our team to help with your progress. They'll see your check-ins, sleep, water, notes, profile and the topics you follow. Turn it off anytime.")}
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={Boolean(share.sharedAt)}
              disabled={shareBusy}
              onChange={(e) => void toggleShare(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="relative h-7 w-12 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-forest peer-disabled:opacity-60 peer-focus-visible:ring-2 peer-focus-visible:ring-forest after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
            />
          </label>
        )}
        <Link href="/me/downloads" className="flex w-full items-center gap-3 p-5 text-left">
          <CloudDownload size={18} className="shrink-0 text-forest" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t("My downloads")}</span>
            <span className="block text-xs text-ink-soft">{t("Guides and lessons for when there's no internet.")}</span>
          </span>
          <ChevronRight size={16} className="text-ink-soft" />
        </Link>
        <button onClick={download} className="flex w-full items-center gap-3 p-5 text-left">
          <Download size={18} className="shrink-0 text-forest" />
          <span className="flex-1 font-semibold">{t("Download my data")}</span>
          <ChevronRight size={16} className="text-ink-soft" />
        </button>
        <button onClick={() => setConfirm(true)} className="flex w-full items-center gap-3 p-5 text-left text-red-700">
          <Trash2 size={18} className="shrink-0" />
          <span className="flex-1 font-semibold">{t("Delete all my data")}</span>
          <ChevronRight size={16} />
        </button>
      </section>

      <section className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
        <Link href="/social/c/tool-doctor-check" className="flex items-center gap-3 p-5">
          <Stethoscope size={18} className="shrink-0 text-forest" />
          <span className="flex-1">
            <span className="block font-semibold">{t("Should I see a doctor?")}</span>
            <span className="block text-xs text-ink-soft">{t("A quick check of signs that need a professional.")}</span>
          </span>
          <ChevronRight size={16} className="text-ink-soft" />
        </Link>
      </section>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title={t("Delete everything?")}>
        <p className="text-sm text-ink-soft">
          {t(
            signedIn
              ? "This removes your points, badges, check-ins, sleep and water records, saved guides and posts from this phone and from your account (your login stays). It can't be undone."
              : "This removes your points, badges, check-ins, sleep and water records, saved guides and posts from this phone. It can't be undone.",
          )}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => setConfirm(false)} className="rounded-full py-3 text-sm font-semibold ring-1 ring-line">
            {t("Keep my data")}
          </button>
          <button onClick={removeAll} className="rounded-full bg-red-700 py-3 text-sm font-semibold text-white">
            {t("Delete")}
          </button>
        </div>
      </Sheet>
    </>
  );
}
