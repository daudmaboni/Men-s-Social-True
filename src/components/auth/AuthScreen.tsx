"use client";

// The sign-in screens (men's log in / sign up, new password, and the Studio): one frosted-glass card
// in the middle of the screen, over soft brand-colour light. X at the top left closes it.

import Link from "next/link";
import { X } from "lucide-react";

export default function AuthScreen({
  closeHref,
  closeLabel,
  title,
  subtitle,
  children,
}: {
  /** Where the X goes */
  closeHref: string;
  closeLabel: string;
  /** Shown under the MS logo at the top of the card (default "Men's Social") */
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-backdrop relative isolate min-h-dvh">
      <div aria-hidden className="auth-light" />
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-6 sm:py-10">
        <div className="glass-card rise relative rounded-[32px] p-5 pt-4 sm:p-7 sm:pt-5">
          <Link
            href={closeHref}
            aria-label={closeLabel}
            className="glass-chip absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-transform hover:text-ink active:scale-95 sm:left-5 sm:top-5"
          >
            <X size={18} />
          </Link>

          <div className="flex flex-col items-center pb-5 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest text-sm font-bold text-mint shadow-lg shadow-forest/25">MS</div>
            <p className="mt-2 text-sm font-bold leading-tight">{title ?? "Men's Social"}</p>
            {subtitle && <p className="text-[11px] text-ink-soft">{subtitle}</p>}
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
