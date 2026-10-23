"use client";

// "Did it help?" on Discover (Step 79), a few days after he did a card. One tap, then it goes away.

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { ContentItem } from "@/lib/content/types";
import { feedStore, useFeed, type HelpedAnswer } from "@/lib/feed/store";
import { dueHelpedCheck, HELPED_EVENT } from "@/lib/social/helped";
import { trackContent } from "@/lib/analytics/track";
import { triedStore } from "@/lib/social/tried";
import { useToast } from "@/components/motion/Toast";
import { haptic } from "@/lib/motion/haptics";
import { useT } from "@/lib/i18n";

const ANSWERS: { id: Exclude<HelpedAnswer, "skip">; label: string }[] = [
  { id: "yes", label: "Yes, it helped" },
  { id: "some", label: "A little" },
  { id: "no", label: "Not really" },
];

export default function HelpedCheck({ items }: { items: ContentItem[] }) {
  const t = useT();
  const sw = t.lang === "sw";
  const feed = useFeed();
  const showToast = useToast();
  const [leaving, setLeaving] = useState(false);
  const id = feed.ready ? dueHelpedCheck(feed.tried) : null;
  const item = id ? items.find((i) => i.id === id) : undefined;
  if (!id || !item) return null;
  const title = sw && item.titleSw ? item.titleSw : item.title;

  const answer = (a: HelpedAnswer) => {
    setLeaving(true);
    haptic("tick");
    setTimeout(() => {
      feedStore.answerHelped(id, a);
      if (a !== "skip") trackContent(id, HELPED_EVENT[a]);
      if (a === "yes") triedStore.markLiked(id); // Step 86: counts toward "N men said this helped"
      if (a === "yes") showToast(t("Good to hear. You'll see more like it."));
      else if (a !== "skip") showToast(t("Thanks. Your feed will use this."));
      setLeaving(false);
    }, 220);
  };

  return (
    <section
      className={`relative rounded-[20px] bg-forest-deep p-4 text-white transition-[opacity,transform] duration-200 ${leaving ? "scale-[0.97] opacity-0" : ""}`}
      aria-label={t("Did it help?")}
    >
      <button onClick={() => answer("skip")} aria-label={t("Not now")} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-white/70">
        <X size={16} />
      </button>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-mint-strong">
        <Sparkles size={14} /> {t("A few days ago you tried")}
      </p>
      <p className="mt-1 pr-8 font-display text-lg font-bold leading-snug">{title}</p>
      <p className="mt-0.5 text-sm text-mint">{t("Did it help?")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ANSWERS.map((a) => (
          <button
            key={a.id}
            onClick={() => answer(a.id)}
            className={`rounded-full px-3.5 py-2 text-sm font-semibold ${a.id === "yes" ? "bg-white text-forest-deep" : "bg-white/10 text-white ring-1 ring-white/20"}`}
          >
            {t(a.label)}
          </button>
        ))}
      </div>
    </section>
  );
}
