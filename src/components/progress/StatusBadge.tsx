"use client";

import type { MetricStatus } from "@/lib/progress/types";
import { useT } from "@/lib/i18n";

const STYLES: Record<MetricStatus, { text: string; cls: string }> = {
  not_recorded: { text: "Not yet recorded", cls: "bg-bg text-ink-soft ring-1 ring-line" },
  tracked: { text: "Tracked", cls: "bg-mint text-forest" },
  goal_achieved: { text: "Goal reached", cls: "bg-forest-deep text-white" },
};

export default function StatusBadge({ status, text }: { status: MetricStatus; text?: string }) {
  const s = STYLES[status];
  const t = useT();
  return <span className={`rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold ${s.cls}`}>{text ?? t(s.text)}</span>;
}
