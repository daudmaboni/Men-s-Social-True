"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import Sheet from "@/components/motion/Sheet";
import { useToast } from "@/components/motion/Toast";
import { TOPICS } from "@/lib/content/library";
import type { TopicId } from "@/lib/content/types";
import { socialStore } from "@/lib/social/store";

export default function InterestsSheet({
  open,
  onClose,
  current,
}: {
  open: boolean;
  onClose: () => void;
  current: TopicId[];
}) {
  const showToast = useToast();
  const [picked, setPicked] = useState<TopicId[]>(current);
  useEffect(() => {
    if (open) setPicked(current);
  }, [open, current]);

  const toggle = (id: TopicId) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Sheet open={open} onClose={onClose} title="Topics you care about">
      <p className="text-xs text-ink-soft">
        We use these to choose what to feature first. Saved on this phone only and never shared.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {TOPICS.map((t) => {
          const on = picked.includes(t.id);
          return (
            <button
              key={t.id}
              aria-pressed={on}
              onClick={() => toggle(t.id)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                on ? "bg-forest text-white" : "ring-1 ring-line"
              }`}
            >
              {on && <Check size={13} />} {t.title}
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-line">
          Cancel
        </button>
        <button
          onClick={() => {
            socialStore.setInterests(picked);
            showToast(picked.length ? "Discover updated for your topics" : "Showing editor's picks");
            onClose();
          }}
          className="rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white"
        >
          Save
        </button>
      </div>
    </Sheet>
  );
}
