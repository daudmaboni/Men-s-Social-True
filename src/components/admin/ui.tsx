"use client";

// Small building blocks shared by every Admin Control Center page.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Inbox, Loader2, X } from "lucide-react";
import { useDialogFocus } from "@/lib/a11y/useDialogFocus";

/* ───────── Page header ───────── */
export function PageHeader({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-soft">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, sub, actions, children, className = "" }: { title?: string; sub?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-surface p-5 ring-1 ring-line ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-bold">{title}</h2>}
            {sub && <p className="mt-0.5 text-xs text-ink-soft">{sub}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/* ───────── Numbers ───────── */
export const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M` : n >= 10_000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : n.toLocaleString("en-GB");

/**
 * A stat tile. `value: null` = not measured yet (shown as "Not tracked yet", never as 0).
 * `delta` compares with the previous period of the same length.
 */
export function Stat({ label, value, hint, delta, unit = "" }: { label: string; value: number | string | null; hint?: string; delta?: { now: number; prev: number } | null; unit?: string }) {
  let deltaText: string | null = null;
  let up = false;
  if (delta && typeof value === "number") {
    if (delta.prev === 0) deltaText = delta.now === 0 ? "No change" : "New this period";
    else {
      const pct = Math.round(((delta.now - delta.prev) / delta.prev) * 100);
      up = pct > 0;
      deltaText = pct === 0 ? "No change" : `${pct > 0 ? "+" : "−"}${Math.abs(pct)}% vs previous`;
    }
  }
  return (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
      <p className="text-xs font-medium text-ink-soft">{label}</p>
      {value === null ? (
        <p className="mt-1.5 text-sm font-semibold text-ink-soft">Not tracked yet</p>
      ) : (
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
          {typeof value === "number" ? compact(value) : value}
          {unit && <span className="ml-0.5 text-base font-medium text-ink-soft">{unit}</span>}
        </p>
      )}
      {deltaText && <p className={`mt-1 text-[0.6875rem] font-medium ${up ? "text-forest" : "text-ink-soft"}`}>{deltaText}</p>}
      {hint && <p className="mt-1 text-[0.6875rem] text-ink-soft">{hint}</p>}
    </div>
  );
}

/* ───────── States ───────── */
export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-soft" aria-busy="true" aria-label={label}>
      <Loader2 size={18} className="animate-spin" /> {label}…
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl px-6 py-12 text-center">
      <Inbox size={26} className="text-ink-soft" aria-hidden />
      <p className="mt-3 font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-soft">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <p className="flex-1">{error}</p>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 font-semibold underline">
          Try again
        </button>
      )}
    </div>
  );
}

/** Honest "this isn't connected yet" box. */
export function NotConnected({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-900">
      <p className="font-semibold">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/* ───────── Controls ───────── */
export const btn = {
  primary:
    "inline-flex items-center justify-center gap-1.5 rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40",
  ghost: "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-line hover:bg-bg disabled:opacity-40",
  danger: "inline-flex items-center justify-center gap-1.5 rounded-full bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40",
  small: "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-line hover:bg-bg disabled:opacity-40",
};
export const input =
  "w-full rounded-xl bg-bg px-3 py-2.5 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-forest disabled:opacity-60";

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; label: string }) {
  return (
    <div className="inline-flex flex-wrap rounded-full bg-surface p-1 ring-1 ring-line" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${value === o.id ? "bg-forest-deep text-white" : "text-ink-soft hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "info" }) {
  const t = {
    neutral: "bg-bg text-ink-soft ring-line",
    good: "bg-mint text-forest-deep ring-mint-strong/40",
    warn: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900",
    bad: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900",
    info: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900",
  }[tone];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ring-1 ${t}`}>{children}</span>;
}

/* ───────── Dialogs ───────── */
/**
 * A confirmation for anything that changes things for men or can't be undone.
 * With `typeToConfirm`, the button only works after typing that word.
 */
export function Confirm({
  open,
  title,
  children,
  confirmLabel,
  danger = false,
  typeToConfirm,
  busy = false,
  disabled = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  typeToConfirm?: string;
  busy?: boolean;
  /** Keeps the button off until the form inside is filled in */
  disabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    setTyped("");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // Step 96: start on the box to type in; for a dangerous action start on Cancel, so Enter never deletes by accident
    ref.current?.querySelector<HTMLElement>(danger ? "input,button[data-cancel]" : "input,button[data-primary]")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, danger]);
  useDialogFocus(ref, open);
  if (!open || typeof document === "undefined") return null;
  const ok = !typeToConfirm || typed.trim().toLowerCase() === typeToConfirm.toLowerCase();
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/40" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div ref={ref} className="page-enter relative w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl ring-1 ring-line">
        <div className="flex items-start justify-between gap-3">
          <h2 className="pt-1 text-base font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-bg hover:text-ink">
            <X size={18} aria-hidden />
          </button>
        </div>
        {children && <div className="mt-2 text-sm text-ink-soft">{children}</div>}
        {typeToConfirm && (
          <label className="mt-4 block text-xs text-ink-soft">
            Type <b className="text-ink">{typeToConfirm}</b> to confirm
            <input value={typed} onChange={(e) => setTyped(e.target.value)} className={`${input} mt-1`} autoComplete="off" />
          </label>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button data-cancel onClick={onClose} className={btn.ghost}>
            Cancel
          </button>
          <button data-primary onClick={onConfirm} disabled={!ok || busy || disabled} className={danger ? btn.danger : btn.primary}>
            {busy && <Loader2 size={14} className="animate-spin" />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** A panel that slides in from the right (details, editors). */
export function Drawer({ open, title, onClose, children, wide = false }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  useDialogFocus(box, open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/30" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div ref={box} className={`page-enter absolute inset-y-0 right-0 flex w-full flex-col bg-surface shadow-xl ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="truncate text-base font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-line">
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ───────── Data loading ───────── */
/** Load data, keep the last result while reloading, and expose errors plainly. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);
  const reload = useCallback(() => {
    const n = ++seq.current;
    setLoading(true);
    run()
      .then((d) => {
        if (n !== seq.current) return;
        setData(d);
        setError(null);
      })
      .catch((e: Error) => n === seq.current && setError(e.message))
      .finally(() => n === seq.current && setLoading(false));
  }, [run]);
  useEffect(() => reload(), [reload]);
  return { data, error, loading, reload, setData };
}

/* ───────── CSV export ───────── */
export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fmtDate = (iso: string | null | undefined, withTime = false) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) })
    : "—";

export const ago = (iso: string | null | undefined) => {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 30 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(iso);
};
