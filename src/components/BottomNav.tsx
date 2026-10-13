"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, ChartColumn, MessageCircle, UserRound } from "lucide-react";

const tabs = [
  { href: "/home", label: "Home", Icon: House },
  { href: "/progress", label: "Progress", Icon: ChartColumn },
  { href: "/social", label: "Social", Icon: MessageCircle },
  { href: "/profile", label: "Profile", Icon: UserRound },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md justify-around px-2 py-2">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex w-16 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors ${
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
