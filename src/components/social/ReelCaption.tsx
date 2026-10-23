"use client";

// A reel's caption (Step 81): two lines with "more", like Instagram; tapped open it shows as a tidy
// list (headings, ✅ points, bullets) instead of one long run of text. Works on light cards and on the
// dark full-screen viewer.

import { useState } from "react";
import { captionPreview, isLongCaption, parseCaption } from "@/lib/content/caption";
import { useT } from "@/lib/i18n";

export default function ReelCaption({ text, dark = false, className = "" }: { text: string; dark?: boolean; className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!text?.trim()) return null;
  const soft = dark ? "text-white/85" : "text-ink-soft";
  const strong = dark ? "text-white" : "text-ink";
  const link = dark ? "text-white" : "text-ink";

  if (!open) {
    const long = isLongCaption(text);
    return (
      <button type="button" onClick={() => long && setOpen(true)} className={`block w-full text-left ${className}`} aria-expanded={long ? false : undefined}>
        <span className={`line-clamp-2 ${soft}`}>{captionPreview(text)}</span>
        {long && <span className={`mt-0.5 block text-[0.8125rem] font-semibold ${link}`}>{t("more")}</span>}
      </button>
    );
  }

  return (
    <div className={className}>
      <div className={`space-y-1.5 ${soft}`}>
        {parseCaption(text).map((b, i) =>
          b.kind === "heading" ? (
            <p key={i} className={`pt-1 text-[0.8125rem] font-bold ${strong}`}>
              {b.text}
            </p>
          ) : b.kind === "item" ? (
            <p key={i} className="flex gap-2">
              <span aria-hidden className="shrink-0">
                {b.mark}
              </span>
              <span>{b.text}</span>
            </p>
          ) : (
            <p key={i}>{b.text}</p>
          ),
        )}
      </div>
      <button type="button" onClick={() => setOpen(false)} className={`mt-1 text-[0.8125rem] font-semibold ${link}`} aria-expanded>
        {t("less")}
      </button>
    </div>
  );
}
