"use client";

// A small bar under a new-password box: how strong it is, and the one thing to fix.

import { checkPassword } from "@/lib/security/password";
import { translate } from "@/lib/i18n/translate";
import type { Lang } from "@/lib/me/lang";

const LABELS = ["Very weak", "Weak", "Okay", "Good", "Strong"] as const;
const COLORS = ["bg-red-500", "bg-red-500", "bg-amber-500", "bg-mint-strong", "bg-forest"];

export default function PasswordMeter({
  password,
  email,
  minLength = 8,
  lang = "en",
}: {
  password: string;
  email?: string | null;
  minLength?: number;
  /** The Studio is in English; the men's screens pass their language. */
  lang?: Lang;
}) {
  const t = (s: string, v?: Record<string, string | number>) => translate(lang, s, v);
  if (!password) {
    return (
      <span className="mt-1 block text-[11px] text-ink-soft">
        {minLength === 8 ? t("At least 8 characters, with letters and numbers.") : t("At least {n} characters, with letters and numbers.", { n: minLength })}
      </span>
    );
  }
  const r = checkPassword(password, { email, minLength });
  return (
    <span className="mt-1.5 block" aria-live="polite">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < Math.max(r.score, 1) ? COLORS[r.score] : "bg-line"}`} />
        ))}
      </span>
      <span className="mt-1 flex justify-between gap-2 text-[11px]">
        <span className={r.ok ? "text-ink-soft" : "text-red-700"}>{r.problem ? t(r.problem, { n: minLength }) : t("Looks good.")}</span>
        <span className="shrink-0 font-semibold text-ink-soft">{t(LABELS[r.score])}</span>
      </span>
    </span>
  );
}
