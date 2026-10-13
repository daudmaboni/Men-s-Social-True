import type { MetricStatus } from "@/lib/progress/types";

/** Honest progress bar: striped when nothing is recorded, never a fake 0% or 100%. */
export default function ProgressBar({
  percent,
  status,
  label,
}: {
  percent: number | null;
  status: MetricStatus;
  label: string;
}) {
  if (status === "not_recorded" || percent === null) {
    return (
      <div className="hatch h-3 w-full rounded-full" role="img" aria-label={`${label}: not yet recorded`} />
    );
  }
  return (
    <div
      className="h-3 w-full overflow-hidden rounded-full bg-mint"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out ${
          status === "goal_achieved" ? "bg-forest-deep" : "bg-forest"
        }`}
        style={{ width: `${Math.max(percent, 4)}%` }}
      />
    </div>
  );
}
