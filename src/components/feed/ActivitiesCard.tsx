"use client";

import { useState } from "react";
import { Check, Clock, Undo2 } from "lucide-react";
import { Why } from "./FeedCards";
import { useToast } from "@/components/motion/Toast";
import { feedStore } from "@/lib/feed/store";
import type { Activity } from "@/lib/feed/catalog";
import type { HomeFeed } from "./useHomeFeed";

export default function ActivitiesCard({ f }: { f: HomeFeed }) {
  const showToast = useToast();
  const [burst, setBurst] = useState<{ id: string; points: number; key: number } | null>(null);

  function done(a: Activity) {
    feedStore.setChoice(a.id, "done");
    setBurst({ id: a.id, points: a.points, key: Date.now() });
    setTimeout(() => setBurst(null), 950);
    showToast(f.isNew ? "Nice! Your points are saved on this phone." : `+${a.points} points`);
  }

  // Check-in, water and sleep have their own cards on this screen, so only show the rest here
  const list = f.activities.filter((a) => !a.tracker);
  const listDone = list.filter((a) => f.statuses[a.id] === "done").length;

  return (
    <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Today&apos;s activities</p>
        <span className="text-xs text-ink-soft">
          {listDone} of {list.length} done
        </span>
      </div>

      <ul className="mt-3 divide-y divide-line">
        {list.map((a) => {
          const s = f.statuses[a.id];
          const title = f.discreet ? a.discreetTitle : a.title;
          const closed = s === "done" || s === "skipped";
          return (
            <li key={a.id} className="relative py-3">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    s === "done" ? "bg-forest text-white" : s === "later" ? "bg-mint text-forest" : "ring-1 ring-line"
                  }`}
                >
                  {s === "done" ? <Check size={14} strokeWidth={3} /> : s === "later" ? <Clock size={12} /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${closed ? "text-ink-soft line-through decoration-line" : ""}`}>
                    {title}
                  </p>
                  <p className="text-[11px] text-ink-soft">
                    {s === "skipped"
                      ? "Skipped today"
                      : s === "later"
                        ? "Saved for later today"
                        : `${a.detail} · +${a.points} points`}
                  </p>

                  {/* Actions */}
                  {!closed && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        onClick={() => done(a)}
                        className="rounded-full bg-forest px-3.5 py-1.5 text-xs font-semibold text-white transition-transform active:scale-95"
                      >
                        Done
                      </button>
                      {s !== "later" && (
                        <button
                          onClick={() => {
                            feedStore.setChoice(a.id, "later");
                            showToast("Saved for later today");
                          }}
                          className="rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ring-line"
                        >
                          Later
                        </button>
                      )}
                      <button
                        onClick={() => {
                          feedStore.setChoice(a.id, "skipped");
                          showToast("Skipped. No problem.");
                        }}
                        className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink-soft"
                      >
                        Skip
                      </button>
                    </div>
                  )}
                  {closed && (
                    <button
                      onClick={() => feedStore.clearChoice(a.id)}
                      className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-forest"
                    >
                      <Undo2 size={11} /> Undo
                    </button>
                  )}
                  {!closed && <Why text={a.why} />}
                </div>
              </div>

              {burst?.id === a.id && (
                <span
                  key={burst.key}
                  className="float-up absolute right-2 top-2 rounded-full bg-forest-deep px-2.5 py-1 text-xs font-bold text-white"
                >
                  +{burst.points}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
