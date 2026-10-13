"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Sparkles, UserRound } from "lucide-react";
import { isTabRoot, TAB_PATHS, tabFor } from "@/lib/tabs";

// Three tabs only. "Man" is Home and Progress in one place.
const tabs = [
  { href: TAB_PATHS[0], label: "Social", Icon: MessageCircle },
  { href: TAB_PATHS[1], label: "Man", Icon: Sparkles },
  { href: TAB_PATHS[2], label: "Me", Icon: UserRound },
];

/**
 * Floating "liquid glass" tab bar: the page shows through, blurred.
 * The glass bubble is tied to the sliding strip, so it glides exactly as far as the page has moved,
 * stretching a little in between tabs.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const active = tabFor(pathname);
  const onRoot = isTabRoot(pathname);

  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="glass-bar relative mx-auto max-w-sm rounded-[30px] p-1.5">
        {active >= 0 && (
          <div aria-hidden className="tab-bubble-track pointer-events-none absolute inset-y-1.5 left-1.5 w-[calc((100%-12px)/3)]">
            <div className="glass-bubble tab-bubble h-full w-full rounded-[24px]" />
          </div>
        )}
        <ul className="relative grid grid-cols-3">
          {tabs.map(({ href, label, Icon }, i) => {
            const on = i === active;
            return (
              <li key={href}>
                <Link
                  href={href}
                  replace={onRoot}
                  scroll={false}
                  aria-current={on ? "page" : undefined}
                  onClick={(e) => {
                    // Tapping the tab you're already on scrolls it back to the top
                    if (on && onRoot) {
                      e.preventDefault();
                      document.getElementById(`tab-panel-${i}`)?.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  className={`flex flex-col items-center gap-0.5 rounded-[24px] py-2 text-[11px] font-semibold transition-colors duration-300 ${
                    on ? "text-forest-deep" : "text-ink-soft"
                  }`}
                >
                  <Icon size={21} strokeWidth={on ? 2.4 : 1.8} className={`transition-transform duration-300 ${on ? "scale-110" : ""}`} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
