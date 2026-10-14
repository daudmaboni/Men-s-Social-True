"use client";

// Me → Notifications: which messages from the team he wants in his inbox (saved in his account).

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useToast } from "@/components/motion/Toast";
import { useT } from "@/lib/i18n";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from "@/lib/notifications/inbox";

const ROWS: { key: keyof Prefs; label: string }[] = [
  { key: "announcements", label: "News from the Men's Social team" },
  { key: "new_content", label: "New guides and videos" },
  { key: "tips", label: "Wellness tips" },
  { key: "community", label: "Community news" },
];

export default function NotificationPrefs() {
  const t = useT();
  const showToast = useToast();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    loadPrefs().then((p) => (p ? setPrefs(p) : setAvailable(false)));
  }, []);
  if (!available) return null;

  async function toggle(key: keyof Prefs, on: boolean) {
    const prev = prefs ?? DEFAULT_PREFS;
    const next = { ...prev, [key]: on };
    setPrefs(next);
    try {
      await savePrefs(next);
      showToast(t("Choice saved"));
    } catch {
      setPrefs(prev);
      showToast(t("Couldn't save just now. We'll try again."));
    }
  }

  return (
    <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
      <div className="flex items-center gap-3">
        <Bell size={18} className="shrink-0 text-forest" />
        <div>
          <p className="font-semibold">{t("Notifications")}</p>
          <p className="text-xs text-ink-soft">{t("Messages from the team arrive in the bell. Warnings about your account always arrive.")}</p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {ROWS.map((r) => (
          <li key={r.key}>
            <label className="flex cursor-pointer items-center justify-between gap-3 py-2.5 text-sm">
              {t(r.label)}
              <input
                type="checkbox"
                role="switch"
                disabled={!prefs}
                checked={(prefs ?? DEFAULT_PREFS)[r.key]}
                onChange={(e) => toggle(r.key, e.target.checked)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="relative h-7 w-12 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-forest peer-focus-visible:ring-2 peer-focus-visible:ring-forest after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
              />
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
