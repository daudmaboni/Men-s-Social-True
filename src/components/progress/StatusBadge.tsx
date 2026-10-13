import type { MetricStatus } from "@/lib/progress/types";

const STYLES: Record<MetricStatus, { text: string; cls: string }> = {
  not_recorded: { text: "Not yet recorded", cls: "bg-bg text-ink-soft ring-1 ring-line" },
  tracked: { text: "Tracked", cls: "bg-mint text-forest" },
  goal_achieved: { text: "Goal reached", cls: "bg-forest-deep text-white" },
};

export default function StatusBadge({ status, text }: { status: MetricStatus; text?: string }) {
  const s = STYLES[status];
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}>{text ?? s.text}</span>;
}
