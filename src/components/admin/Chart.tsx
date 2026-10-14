"use client";

// One chart for the dashboard: a single series per day (columns), hover/focus for the exact value,
// a hairline grid, rounded column tops, and a table view so no value is hover-only.
// Colour: the brand accent (var(--forest)), which clears 3:1 contrast on both light and dark surfaces.

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type Point = { day: string; n: number };

const niceMax = (v: number) => {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = [1, 2, 2.5, 5, 10].find((x) => x * p >= v)!;
  return m * p;
};
const shortDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function DailyColumns({ data, label, unit, height = 160 }: { data: Point[]; label: string; unit: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const id = useId();
  const max = useMemo(() => niceMax(Math.max(0, ...data.map((d) => d.n))), [data]);
  const total = data.reduce((s, d) => s + d.n, 0);
  // Draw at the real width so labels stay 10px on phones instead of shrinking with the picture
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [table]);
  const H = height, padL = 32, padB = 22, padT = 8;
  const plotW = W - padL, plotH = H - padB - padT;
  const band = plotW / Math.max(data.length, 1);
  const barW = Math.min(24, Math.max(2, band - 2));
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(W / 90)));

  return (
    <figure className="space-y-2" aria-labelledby={`${id}-cap`}>
      <figcaption id={`${id}-cap`} className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-soft">
          {label}: <b className="font-semibold text-ink tabular-nums">{total.toLocaleString("en-GB")}</b> {unit}
        </span>
        <button onClick={() => setTable((t) => !t)} className="text-[11px] font-semibold text-forest underline-offset-2 hover:underline">
          {table ? "Show chart" : "Show as table"}
        </button>
      </figcaption>
      {table ? (
        <div className="max-h-56 overflow-y-auto rounded-xl ring-1 ring-line">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface text-left text-ink-soft">
              <tr>
                <th className="px-3 py-2 font-semibold">Day</th>
                <th className="px-3 py-2 text-right font-semibold">{unit}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...data].reverse().map((d) => (
                <tr key={d.day}>
                  <td className="px-3 py-1.5">{shortDay(d.day)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative" ref={box}>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label={`${label} per day, total ${total}`}>
            {ticks.map((t) => {
              const y = padT + plotH - (t / max) * plotH;
              return (
                <g key={t}>
                  <line x1={padL} x2={W} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} />
                  <text x={padL - 6} y={y + 3} textAnchor="end" fontSize={10} fill="var(--ink-soft)">
                    {t >= 1000 ? `${t / 1000}K` : t}
                  </text>
                </g>
              );
            })}
            {data.map((d, i) => {
              const h = (d.n / max) * plotH;
              const x = padL + i * band + (band - barW) / 2;
              const y = padT + plotH - h;
              const r = Math.min(4, barW / 2, h);
              return (
                <g key={d.day}>
                  {h > 0 && (
                    <path
                      d={`M${x},${padT + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${padT + plotH} Z`}
                      fill="var(--forest)"
                      opacity={hover === null || hover === i ? 1 : 0.55}
                    />
                  )}
                  {/* Hit target: the whole column band, not just the painted bar */}
                  <rect
                    x={padL + i * band}
                    y={padT}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${shortDay(d.day)}: ${d.n} ${unit}`}
                    onPointerEnter={() => setHover(i)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                  />
                  {i % labelEvery === 0 && (
                    <text x={padL + i * band + band / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--ink-soft)">
                      {shortDay(d.day)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          {hover !== null && data[hover] && (
            <div
              className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-surface px-2.5 py-1.5 text-xs shadow-lg ring-1 ring-line"
              style={{ left: `${((padL + hover * band + band / 2) / W) * 100}%` }}
              role="status"
            >
              <b className="tabular-nums">{data[hover].n}</b> <span className="text-ink-soft">{unit} · {shortDay(data[hover].day)}</span>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

/** Ranked horizontal bars for "top N" lists (value at the tip, text in ink, never in the bar colour). */
export function RankBars({ rows, unit }: { rows: { label: string; n: number; sub?: string }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="text-xs">
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate font-medium">{r.label}</span>
            <span className="shrink-0 tabular-nums text-ink-soft">
              {r.n.toLocaleString("en-GB")} {unit}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-bg" aria-hidden>
            <div className="h-2 rounded-full bg-forest" style={{ width: `${Math.max(2, (r.n / max) * 100)}%` }} />
          </div>
          {r.sub && <p className="mt-0.5 truncate text-[11px] text-ink-soft">{r.sub}</p>}
        </li>
      ))}
    </ul>
  );
}
