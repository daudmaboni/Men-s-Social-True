"use client";

// Step 90: Me → Settings → Save data (Auto / On / Off).

import { Gauge } from "lucide-react";
import { setSaveDataPref, useSaveData, useSaveDataPref, type SaveDataPref } from "@/lib/media/saveData";
import { useT } from "@/lib/i18n";

export default function SaveDataSetting() {
  const t = useT();
  const pref = useSaveDataPref();
  const on = useSaveData();
  return (
    <div className="border-t border-line p-5">
      <div className="flex items-center gap-3">
        <Gauge size={18} className="shrink-0 text-forest" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t("Save data")}</span>
          <span className="block text-xs text-ink-soft">{t("Reels wait for a tap, photos come smaller and cards open on their words. Good for slow or expensive bundles.")}</span>
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 rounded-full bg-bg p-1 text-xs font-semibold ring-1 ring-line" role="radiogroup" aria-label={t("Save data")}>
        {(["auto", "on", "off"] as SaveDataPref[]).map((p) => (
          <button key={p} role="radio" aria-checked={pref === p} onClick={() => setSaveDataPref(p)} className={`rounded-full py-2 ${pref === p ? "bg-forest text-white" : "text-ink-soft"}`}>
            {t(p === "auto" ? "Auto" : p === "on" ? "On" : "Off")}
          </button>
        ))}
      </div>
      {pref === "auto" && <p className="mt-2 text-[0.6875rem] text-ink-soft">{t(on ? "On now: your connection is slow or Data Saver is on." : "Turns on by itself on 2G/3G or with Data Saver.")}</p>}
    </div>
  );
}
