"use client";

import { weekdayLetter } from "@/lib/progress/dates";
import { useT } from "@/lib/i18n";

/**
 * Bars per day from real records.
 * - Recorded day: solid bar, height = value compared with the goal
 * - Goal reached: dark green
 * - Nothing recorded: short striped stub (missing is NOT shown as zero)
 */
export default function DayBars({
  keys,
  values,
  target,
  format,
  scaleMax,
  compact = false,
}: {
  keys: string[];
  values: (number | null)[];
  target: number | null;
  format: (v: number) => string;
  /** Fixed top of the scale (e.g. 5 for ratings). Otherwise the goal or the highest value. */
  scaleMax?: number;
  /** Shorter chart without the colour key. */
  compact?: boolean;
}) {
  const max = scaleMax ?? Math.max(target ?? 0, ...values.map((v) => v ?? 0), 1);
  const dense = keys.length > 10;
  const t = useT();

  return (
    <div>
      <div className={`flex items-end ${compact ? "h-20" : "h-32"} ${dense ? "gap-[3px]" : "gap-2"}`}>
        {keys.map((k, i) => {
          const v = values[i];
          const met = v !== null && target !== null && v >= target;
          return (
            <div
              key={k}
              className="flex h-full flex-1 flex-col items-center justify-end"
              title={v === null ? `${k}: ${t("not recorded")}` : `${k}: ${format(v)}`}
            >
              {v === null ? (
                <div className="hatch h-[18%] w-full rounded-full" />
              ) : (
                <div
                  className={`grow-bar w-full rounded-full ${met ? "bg-forest-deep" : "bg-mint-strong"}`}
                  style={{
                    height: `${Math.max((v / max) * 100, 6)}%`,
                    animationDelay: `${Math.min(i * 40, 600)}ms`,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      {!dense && (
        <div className="mt-2 flex gap-2">
          {keys.map((k) => (
            <span key={k} className="flex-1 text-center text-[11px] text-ink-soft">
              {weekdayLetter(k, t.lang)}
            </span>
          ))}
        </div>
      )}
      {!compact && (
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-soft">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-forest-deep" /> {t("Goal reached")}</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-mint-strong" /> {t("Recorded")}</span>
        <span className="flex items-center gap-1.5"><i className="hatch h-2 w-2 rounded-full" /> {t("Not recorded")}</span>
      </div>
      )}
    </div>
  );
}
