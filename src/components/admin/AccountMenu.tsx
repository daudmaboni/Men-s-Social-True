"use client";

// Bottom of the Studio sidebar: one clean row (avatar, name, role). Tapping it opens a small card with
// Appearance (light / dark / auto), Colour, Font style, Text size, Account settings and Sign out — so the menu stays about navigation.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronUp, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
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
  const display = prettyName(name);
  const initial = (display.match(/[A-Za-z0-9]/)?.[0] ?? "?").toUpperCase();

  // Close on a tap outside or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
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
        aria-haspopup="menu"
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

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className={`menu-pop absolute z-50 max-h-[calc(100dvh-5rem)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-2xl bg-surface p-3 shadow-2xl ring-1 ring-line ${
            compact ? "bottom-0 left-full ml-3" : "bottom-full left-0 mb-2"
          }`}
        >
          {/* Who */}
          <div className="flex items-center gap-3 px-1 pb-3">
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
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium hover:bg-bg"
            >
              <Settings size={16} className="text-ink-soft" /> Account settings
            </Link>
            <button
              role="menuitem"
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
