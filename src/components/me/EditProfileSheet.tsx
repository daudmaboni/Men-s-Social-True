"use client";

// "Edit profile" on Me: add, change or delete his photo, name, age range and region.
// All optional and private; only his name is shown in Community (unless he posts anonymously).

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import Sheet from "@/components/motion/Sheet";
import { useToast } from "@/components/motion/Toast";
import { AGE_RANGES, NAME_MAX, REGIONS, nameProblem, photoToDataUrl, type AgeRange, type Profile } from "@/lib/me/profile";
import { socialStore } from "@/lib/social/store";
import { useT } from "@/lib/i18n";
import Avatar from "./Avatar";

export default function EditProfileSheet({
  open,
  onClose,
  name: savedName,
  profile,
  account,
  welcome = false,
  suggestedName,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  profile: Profile;
  /** His login (email or phone), shown read-only. */
  account: string | null;
  /** First time after he creates an account: a welcome line, "Later" instead of delete. */
  welcome?: boolean;
  /** Prefilled when he has no name yet (e.g. his first name from Google). He can change it. */
  suggestedName?: string;
}) {
  const t = useT();
  const showToast = useToast();
  const [name, setName] = useState(savedName);
  const [photo, setPhoto] = useState(profile.photo);
  const [ageRange, setAgeRange] = useState<AgeRange | undefined>(profile.ageRange);
  const [region, setRegion] = useState(profile.region ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  // Start from what's saved each time the sheet opens
  const [openedFor, setOpenedFor] = useState(false);
  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      setName(savedName || suggestedName || "");
      setPhoto(profile.photo);
      setAgeRange(profile.ageRange);
      setRegion(profile.region ?? "");
      setError("");
      setConfirmDelete(false);
    }
  }

  async function pickPhoto(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      setPhoto(await photoToDataUrl(f));
    } catch (e) {
      setError(t((e as Error).message));
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  function save() {
    const problem = nameProblem(name);
    if (problem) return setError(t(problem));
    socialStore.saveProfile(name, { photo, ageRange, region: region || undefined });
    onClose();
    showToast(t("Profile saved"));
  }

  function removeAll() {
    socialStore.clearProfile();
    onClose();
    showToast(t("Profile details deleted"));
  }

  const chip = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-semibold ${on ? "bg-forest text-white" : "bg-bg text-ink-soft ring-1 ring-line"}`;

  return (
    <Sheet open={open} onClose={onClose} title={t(welcome ? "Create your profile" : "Edit profile")}>
      <div className="space-y-5">
        {welcome && <p className="-mt-1 text-sm text-ink-soft">{t("Welcome! Add a few details so the app feels like yours. Everything is optional and private.")}</p>}
        {/* Photo */}
        <div className="flex items-center gap-4">
          <Avatar name={name} photo={photo} className="h-20 w-20 text-2xl" />
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => file.current?.click()}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
              {photo ? t("Change photo") : t("Add photo")}
            </button>
            {photo && (
              <button type="button" onClick={() => setPhoto(undefined)} className="block text-xs font-semibold text-ink-soft">
                {t("Remove photo")}
              </button>
            )}
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          </div>
        </div>
        <p className="-mt-2 text-[0.6875rem] text-ink-soft">{t("Only you see your photo. Please don't use intimate photos.")}</p>

        {/* Name */}
        <label className="block">
          <span className="text-xs font-semibold text-ink-soft">{t("Name or nickname")}</span>
          <input
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder={t("e.g. Juma")}
            className="mt-1 w-full rounded-2xl bg-bg px-4 py-3 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-forest"
          />
          <span className="mt-1 block text-[0.6875rem] text-ink-soft">
            {t("Also your name in Community, unless you post anonymously.")}
          </span>
        </label>

        {/* Age range */}
        <div>
          <p className="text-xs font-semibold text-ink-soft">{t("Age range")}</p>
          <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label={t("Age range")}>
            {AGE_RANGES.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={ageRange === a}
                onClick={() => setAgeRange(ageRange === a ? undefined : a)}
                className={chip(ageRange === a)}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Region */}
        <label className="block">
          <span className="text-xs font-semibold text-ink-soft">{t("Region")}</span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="mt-1 w-full rounded-2xl bg-bg px-4 py-3 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-forest"
          >
            <option value="">{t("Not set")}</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r === "Outside Tanzania" ? t("Outside Tanzania") : r}
              </option>
            ))}
          </select>
        </label>

        {/* Login */}
        {account && (
          <div className="rounded-2xl bg-bg px-4 py-3 ring-1 ring-line">
            <p className="text-xs font-semibold text-ink-soft">{t("Logged in as")}</p>
            <p className="truncate text-sm">{account}</p>
          </div>
        )}

        <p className="text-[0.6875rem] text-ink-soft">{t("All optional and private to you. Kayani staff can't see it unless you share your records with support in Settings.")}</p>

        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}
        <button onClick={save} disabled={busy} className="w-full rounded-full bg-forest py-3 text-sm font-semibold text-white disabled:opacity-60">
          {t("Save")}
        </button>

        {welcome ? (
          <button type="button" onClick={onClose} className="w-full py-1 text-sm font-semibold text-ink-soft">
            {t("Later")}
          </button>
        ) : !confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex w-full items-center justify-center gap-1.5 py-1 text-xs font-semibold text-red-700"
          >
            <Trash2 size={13} /> {t("Delete my profile details")}
          </button>
        ) : (
          <div className="rounded-2xl bg-red-50 p-3 text-xs text-red-800">
            <p>{t("This removes your name, photo, age range and region. Your points, badges and records stay.")}</p>
            <div className="mt-2 flex gap-2">
              <button onClick={removeAll} className="rounded-full bg-red-700 px-3 py-1.5 font-semibold text-white">
                {t("Delete")}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="rounded-full px-3 py-1.5 font-semibold ring-1 ring-red-200">
                {t("Cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
