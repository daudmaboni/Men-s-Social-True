"use client";

// A row inside a settings card that unfolds when tapped and folds again when tapped or scrolled
// off the screen (Step 66, same feel as the fold cards from Step 51). Used for Appearance and Font style.

import { useCallback, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useFoldOnLeave } from "./FoldCard";

export default function FoldRow({
  icon,
  title,
  sub,
  children,
  nested = false,
  showMore = "Show more",
  showLess = "Show less",
}: {
  icon?: React.ReactNode;
  title: string;
  /** A short line under the title: what's chosen now. */
  sub?: React.ReactNode;
  children: React.ReactNode;
  /** Inside another fold row: smaller, on the page background. */
  nested?: boolean;
  showMore?: string;
  showLess?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [instant, setInstant] = useState(false);
  const body = useId();
  const close = useCallback(() => {
    setInstant(true);
    setOpen(false);
  }, []);
  useFoldOnLeave(box, open, close);

  return (
    <div ref={box} className={nested ? "rounded-2xl bg-bg ring-1 ring-line" : ""}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={body}
        onClick={() => {
          setInstant(false);
          setOpen((o) => !o);
        }}
        className={`flex w-full items-center gap-3 text-left ${nested ? "px-3.5 py-3" : "p-5"}`}
      >
        {icon}
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold ${nested ? "text-sm" : ""}`}>{title}</span>
          {sub && <span className="block truncate text-xs text-ink-soft">{sub}</span>}
        </span>
        <span
          aria-hidden
          title={open ? showLess : showMore}
          className={`flex shrink-0 items-center justify-center rounded-full bg-mint text-forest transition-transform duration-300 ${nested ? "h-7 w-7" : "h-9 w-9"} ${open ? "rotate-180" : ""}`}
        >
          <ChevronDown size={nested ? 15 : 18} />
        </span>
      </button>
      <div id={body} className="expand" data-open={open} data-instant={instant} inert={!open}>
        <div>
          <div className={nested ? "px-3.5 pb-3.5" : "px-5 pb-5"}>{children}</div>
        </div>
      </div>
    </div>
  );
}
