"use client";

// Step 90: a 4-digit PIN pad (big keys for the thumb). Used by the lock screen and when he sets his PIN.

import { useEffect, useRef, useState } from "react";
import { Delete } from "lucide-react";
import { PIN_LENGTH } from "@/lib/privacy/lock";
import { haptic } from "@/lib/motion/haptics";
import { useT } from "@/lib/i18n";

export default function PinPad({
  onDone,
  error,
  busy = false,
  dark = false,
  extra,
}: {
  /** Called with the 4 digits; return false (or a promise of false) to shake and clear. */
  onDone: (pin: string) => boolean | Promise<boolean>;
  error?: string | null;
  busy?: boolean;
  dark?: boolean;
  /** A key bottom-left (e.g. fingerprint). */
  extra?: React.ReactNode;
}) {
  const t = useT();
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;
    let gone = false;
    void Promise.resolve(onDone(pin)).then((ok) => {
      if (gone) return;
      if (!ok) {
        haptic("tick");
        setShake(true);
        setTimeout(() => setShake(false), 400);
      }
      setPin("");
    });
    return () => {
      gone = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  // A computer keyboard works too
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      // Only the pad on screen (the Man and Me tabs each have one)
      const r = box.current?.getBoundingClientRect();
      if (!r || r.width === 0 || r.right <= 0 || r.left >= window.innerWidth) return;
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < PIN_LENGTH ? p + e.key : p));
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy]);

  const press = (d: string) => {
    if (busy || pin.length >= PIN_LENGTH) return;
    haptic("tick");
    setPin((p) => p + d);
  };
  const key = `flex h-16 items-center justify-center rounded-full text-2xl font-semibold transition-transform active:scale-90 disabled:opacity-40 ${
    dark ? "bg-white/10 text-white" : "bg-bg text-ink ring-1 ring-line"
  }`;

  return (
    <div ref={box} className="mx-auto w-full max-w-[280px]">
      <div className={`flex justify-center gap-4 ${shake ? "pin-shake" : ""}`} aria-label={t("{n} of {total} digits", { n: pin.length, total: PIN_LENGTH })}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full transition-colors ${i < pin.length ? (dark ? "bg-white" : "bg-forest") : dark ? "bg-white/25" : "bg-line"}`}
          />
        ))}
      </div>
      <p className={`mt-3 min-h-5 text-center text-sm font-semibold ${dark ? "text-honey" : "text-red-600"}`} aria-live="polite">
        {error ?? ""}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" className={key} disabled={busy} onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <span className="flex items-center justify-center">{extra}</span>
        <button type="button" className={key} disabled={busy} onClick={() => press("0")}>
          0
        </button>
        <button
          type="button"
          aria-label={t("Delete")}
          disabled={busy || !pin}
          onClick={() => setPin((p) => p.slice(0, -1))}
          className={`flex h-16 items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-30 ${dark ? "text-white" : "text-ink"}`}
        >
          <Delete size={24} />
        </button>
      </div>
    </div>
  );
}
