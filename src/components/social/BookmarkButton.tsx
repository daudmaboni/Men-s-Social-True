"use client";

import { Bookmark } from "lucide-react";
import { useToast } from "@/components/motion/Toast";
import { socialStore, useSocial } from "@/lib/social/store";
import { inviteToAccount } from "@/components/account/AccountInvite";
import { useT } from "@/lib/i18n";
import { trackContent } from "@/lib/analytics/track";

export default function BookmarkButton({
  contentId,
  variant = "light",
  size = 18,
}: {
  contentId: string;
  variant?: "light" | "dark" | "plain";
  size?: number;
}) {
  const { bookmarks, ready } = useSocial();
  const showToast = useToast();
  const t = useT();
  const saved = Boolean(bookmarks[contentId]);

  const styles = {
    light: "bg-surface text-ink ring-1 ring-line",
    dark: "bg-white/15 text-white",
    plain: "text-ink-soft",
  }[variant];

  return (
    <button
      type="button"
      disabled={!ready}
      aria-pressed={saved}
      aria-label={t(saved ? "Remove from saved" : "Save for later")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const nowSaved = socialStore.toggleBookmark(contentId);
        if (nowSaved) trackContent(contentId, "save");
        showToast(t(nowSaved ? "Saved for later" : "Removed from saved"));
        if (nowSaved) inviteToAccount("first-save");
      }}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 ${styles}`}
    >
      <Bookmark size={size} fill={saved ? "currentColor" : "none"} strokeWidth={2} />
    </button>
  );
}
