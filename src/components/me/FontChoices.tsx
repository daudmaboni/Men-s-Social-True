"use client";

// Font style and text size pickers (Step 66). The same pieces are used on Me → Settings (translated)
// and in the Studio's account menu (English). Each side remembers its own choice.

import { Check } from "lucide-react";
import FoldRow from "@/components/motion/FoldRow";
import { FONTS, FONT_GROUPS, TEXT_SIZES, fontById, setFont, setTextSize, useFont, useTextSize, type Scope } from "@/lib/fonts";

type Tr = (s: string, vars?: Record<string, string | number>) => string;
const plain: Tr = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? "")) : s);

export function FontStylePicker({ scope, t = plain, onPicked }: { scope: Scope; t?: Tr; onPicked?: (name: string) => void }) {
  const current = useFont(scope);
  const chosen = fontById(current);
  const name = (id: string, n: string) => (id === "system" || id === "kayani" ? t(n) : n);
  return (
    <FoldRow nested title={t("Font style")} sub={name(chosen.id, chosen.name)} showMore={t("Show more")} showLess={t("Show less")}>
      <div className="space-y-3">
        {FONT_GROUPS.map((g) => {
          const fonts = FONTS.filter((f) => g.kinds.includes(f.kind));
          return (
            <div key={g.heading}>
              <p className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-wider text-ink-soft">{t(g.heading)}</p>
              <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={t(g.heading)}>
                {fonts.map((f) => {
                  const on = f.id === current;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setFont(scope, f.id);
                        onPicked?.(name(f.id, f.name));
                      }}
                      className={`relative rounded-xl px-3 py-2.5 text-left transition-colors ${on ? "bg-surface ring-2 ring-forest" : "bg-surface/60 ring-1 ring-line hover:bg-surface"}`}
                      style={{ fontFamily: f.stack }}
                    >
                      <span className="block text-[1.0625rem] font-semibold leading-tight">{name(f.id, f.name)}</span>
                      <span className="mt-0.5 block truncate text-xs text-ink-soft">{t("Habari kaka, Aa 123")}</span>
                      {on && (
                        <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-forest text-white" aria-hidden>
                          <Check size={10} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </FoldRow>
  );
}

export function TextSizePicker({ scope, t = plain, onPicked }: { scope: Scope; t?: Tr; onPicked?: (name: string) => void }) {
  const size = useTextSize(scope);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold text-ink-soft">{t("Text size")}</p>
        <p className="text-xs text-ink-soft">{t(TEXT_SIZES.find((s) => s.id === size)?.heading ?? "Normal")}</p>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={t("Text size")}>
        {TEXT_SIZES.map((s, i) => {
          const on = s.id === size;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={t(s.heading)}
              onClick={() => {
                setTextSize(scope, s.id);
                onPicked?.(t(s.heading));
              }}
              className={`flex h-12 items-end justify-center rounded-xl pb-2 font-semibold leading-none transition-colors ${on ? "bg-forest text-white" : "bg-bg text-ink-soft ring-1 ring-line hover:text-ink"}`}
            >
              {/* Fixed pixel sizes so the buttons show the difference whatever size is chosen */}
              <span style={{ fontSize: `${13 + i * 4}px` }}>A</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
