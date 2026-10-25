"use client";

// Bottom of the Studio sidebar: one clean row (avatar, name, role). Tapping it opens a card in the middle of the screen,
// over a blurred background (Step 88, phones and computers), with
// Appearance (light / dark / auto), Colour, Font style, Text size, Account settings and Sign out — so the menu stays about navigation.

import { growFromTrigger } from "@/lib/motion/origin";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "@/lib/a11y/useDialogFocus";
import Link from "next/link";
import { Check, ChevronUp, LogOut, Monitor, Moon, Settings, Sun, X } from "lucide-react";
import { FontStylePicker, TextSizePicker } from "@/components/me/FontChoices";
import { ACCENTS, setAccent, setThemePref, useAccent, useThemePref, type ThemePref } from "@/lib/theme";

const THEMES: { id: ThemePref; label: string; Icon: typeof Sun }[] = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "auto", label: "Auto", Icon: Monitor },
];

/** "theadmin" → "TheAdmin"; other names just get a capital first letter. */
export function prettyName(name: string): string {
  if (name.toLowerCase() === "theadmin") return "TheAdmin";
  return name ? name[0].toUpperCase() + name.slice(1) : name;
}

export default function AccountMenu({
  name,
  role,
  email,
  compact = false,
  onSignOut,
  onNavigate,
}: {
  name: string;
  role: string;
  email?: string;
  /** Collapsed sidebar: just the avatar; the card opens to the right. */
  compact?: boolean;
  onSignOut: () => void;
  /** Called when a link inside is used (e.g. to close the phone drawer). */
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement | null>(null);
  useDialogFocus(card, open); // Step 96
  // Nothing behind scrolls while it's open in the middle
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const was = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = was;
    };
  }, [open]);
  const display = prettyName(name);
  const initial = (display.match(/[A-Za-z0-9]/)?.[0] ?? "?").toUpperCase();

  // Close on a tap outside or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !card.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={compact ? `${display} · ${role}` : undefined}
        className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-bg ${open ? "bg-bg" : ""} ${compact ? "justify-center" : ""}`}
      >
        <Avatar initial={initial} />
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{display}</span>
              <span className="mt-0.5 inline-block rounded-full bg-mint px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-forest-deep">{role}</span>
            </span>
            <ChevronUp size={16} className={`shrink-0 text-ink-soft transition-transform duration-200 ${open ? "" : "rotate-180"}`} aria-hidden />
          </>
        )}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="menu-scrim absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <div
              ref={(el) => {
                card.current = el;
                growFromTrigger(el);
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Account"
              className="menu-pop relative max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto overscroll-contain rounded-3xl bg-surface p-4 shadow-2xl ring-1 ring-line lg:max-w-md lg:p-6"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-ink-soft ring-1 ring-line"
              >
                <X size={16} />
              </button>
              {/* Who */}
              <div className="flex items-center gap-3 px-1 pb-3 pr-10">
                <Avatar initial={initial} big />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{display}</p>
                  <p className="truncate text-xs text-ink-soft">{email && !email.endsWith("@studio.menssocial.app") ? email : role}</p>
                </div>
              </div>

              {/* Appearance */}
              <div className="border-t border-line pt-3">
                <p className="px-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-soft">Appearance</p>
                <ThemeChoice />
              </div>

              {/* Colour */}
              <div className="mt-3">
                <p className="px-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-soft">Colour</p>
                <AccentChoice />
              </div>

              {/* Font style and text size (Step 66): the Studio keeps its own, separate from the men's app */}
              <div className="mt-3">
                <FontStylePicker scope="studio" />
              </div>
              <div className="mt-3 px-1">
                <TextSizePicker scope="studio" />
              </div>

              {/* Links */}
              <div className="mt-3 space-y-0.5 border-t border-line pt-2">
                <Link
                  href="/studio/settings"
                  onClick={() => {
                    setOpen(false);
                    onNavigate?.();
                  }}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium hover:bg-bg"
                >
                  <Settings size={16} className="text-ink-soft" /> Account settings
                </Link>
                <button
                  onClick={() => {
                    setOpen(false);
                    onSignOut();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function Avatar({ initial, big = false }: { initial: string; big?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-forest font-bold text-white ${big ? "h-11 w-11 text-base" : "h-9 w-9 text-sm"}`}
      aria-hidden
    >
      {initial}
    </span>
  );
}

/** Light / Dark / Auto as three small icon buttons; the chosen one gets a quiet highlight. */
export function ThemeChoice() {
  const theme = useThemePref();
  return (
    <div className="mt-1.5 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Appearance">
      {THEMES.map(({ id, label, Icon }) => {
        const on = theme === id;
        return (
          <button
            key={id}
            role="radio"
            aria-checked={on}
            onClick={(e) => setThemePref(id, { x: e.clientX, y: e.clientY })}
            className={`flex flex-col items-center gap-1 rounded-xl py-2.5 text-[0.6875rem] font-semibold transition-colors ${
              on ? "bg-mint text-forest-deep ring-1 ring-forest/40" : "text-ink-soft ring-1 ring-line hover:bg-bg"
            }`}
          >
            <Icon size={17} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Colour swatches with their names and a tick on the chosen one. The page changes behind as you tap. */
export function AccentChoice() {
  const accent = useAccent();
  return (
    <div className="mt-1.5 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Colour">
      {ACCENTS.map((a) => {
        const on = accent === a.id;
        return (
          <button
            key={a.id}
            role="radio"
            aria-checked={on}
            onClick={(e) => setAccent(a.id, { x: e.clientX, y: e.clientY })}
            className={`flex items-center gap-2 rounded-xl px-2 py-2 text-[0.6875rem] font-semibold transition-colors ${on ? "bg-bg ring-1 ring-ink/30" : "text-ink-soft ring-1 ring-line hover:bg-bg"}`}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: a.swatch }} aria-hidden>
              {on && <Check size={12} strokeWidth={3} />}
            </span>
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
