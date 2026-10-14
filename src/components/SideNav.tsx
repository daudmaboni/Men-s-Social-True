"use client";

// On a computer (wide screens) the three tabs move into a sidebar on the left,
// like a web app. On phones this is hidden and the Liquid Glass tab bar at the bottom is used instead.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, ShoppingBag, Sparkles, UserRound } from "lucide-react";
import { isTabRoot, TAB_PATHS, tabFor } from "@/lib/tabs";
import { useToast } from "@/components/motion/Toast";
import { setLang, useLang } from "@/lib/me/lang";
import { useT } from "@/lib/i18n";

const tabs = [
  { href: TAB_PATHS[0], label: "Social", about: "Guides and Community", Icon: MessageCircle },
  { href: TAB_PATHS[1], label: "Man", about: "Your day and your trends", Icon: Sparkles },
  { href: TAB_PATHS[2], label: "Me", about: "Profile, badges and settings", Icon: UserRound },
];

export default function SideNav() {
  const pathname = usePathname();
  const active = tabFor(pathname);
  const onRoot = isTabRoot(pathname);
  const showToast = useToast();
  const lang = useLang();
  const t = useT();

  return (
    <aside
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface px-4 py-6 lg:flex"
    >
      {/* Logo */}
      <Link href="/man" className="flex items-center gap-2.5 px-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest text-sm font-bold text-mint">MS</span>
        <span className="leading-tight">
          <span className="block text-base font-semibold">Men&apos;s Social</span>
          <span className="block text-[11px] text-ink-soft">Kayani</span>
        </span>
      </Link>

      {/* The three tabs */}
      <nav className="mt-8 space-y-1">
        {tabs.map(({ href, label, about, Icon }, i) => {
          const on = i === active;
          return (
            <Link
              key={href}
              href={href}
              replace={onRoot}
              scroll={false}
              aria-current={on ? "page" : undefined}
              onClick={(e) => {
                // Clicking the tab you're already on scrolls it back to the top
                if (on && onRoot) {
                  e.preventDefault();
                  document.getElementById(`tab-panel-${i}`)?.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors ${
                on ? "bg-mint text-forest-deep" : "text-ink-soft hover:bg-bg hover:text-ink"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  on ? "bg-forest text-white" : "bg-bg text-ink-soft group-hover:text-forest"
                }`}
              >
                <Icon size={18} strokeWidth={on ? 2.4 : 1.9} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{t(label)}</span>
                <span className="block truncate text-[11px] font-normal opacity-80">{t(about)}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        {/* Shop (coming soon) */}
        <button
          onClick={() => showToast(t("The shop is coming soon"))}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-ink-soft transition-colors hover:bg-bg hover:text-ink"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg">
            <ShoppingBag size={18} />
          </span>
          {t("Shop")}
        </button>

        {/* Language: the same setting as Me → Language */}
        <div className="flex rounded-full bg-bg p-1 text-xs font-semibold" role="group" aria-label={t("Language")}>
          {(["en", "sw"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`flex-1 rounded-full py-1.5 transition-colors ${lang === l ? "bg-forest text-white" : "text-ink-soft"}`}
            >
              {l === "en" ? "English" : "Kiswahili"}
            </button>
          ))}
        </div>

        <p className="px-2 text-[11px] leading-relaxed text-ink-soft">
          {t("General education, not medical advice.")}
        </p>
      </div>
    </aside>
  );
}
