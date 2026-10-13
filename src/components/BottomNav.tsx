"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Sparkles, UserRound } from "lucide-react";

// Three tabs only. "Man" is Home and Progress in one place.
const tabs = [
  { href: "/social", label: "Social", Icon: MessageCircle },
  { href: "/man", label: "Man", Icon: Sparkles },
  { href: "/me", label: "Me", Icon: UserRound },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md justify-around px-2 py-2">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href) || (href === "/man" && pathname.startsWith("/learn"));
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex w-20 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors ${
                  active ? "text-forest" : "text-ink-soft"
                }`}
              >
                <span
                  className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-mint" : ""
                  }`}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
