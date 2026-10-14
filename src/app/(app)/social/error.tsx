"use client";

import { useT } from "@/lib/i18n";

// Shown if anything on the Social pages fails to load, instead of a blank screen.
export default function SocialError({ reset }: { error: Error; reset: () => void }) {
  const t = useT();
  return (
    <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line" role="alert">
      <p className="font-semibold">{t("Something went wrong")}</p>
      <p className="mt-1 text-sm text-ink-soft">{t("This page couldn't load. Your saved items are safe.")}</p>
      <button onClick={reset} className="mt-4 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white">
        {t("Try again")}
      </button>
    </div>
  );
}
