"use client";

// After a man creates an account (or signs in for the first time on a phone), open "Create your profile"
// by itself instead of leaving him to find Me → Edit profile. Shown once per account on this phone,
// only after his account data has loaded (so a man who already has a profile is never asked again).

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { accountLabel, useAccount } from "@/lib/account/useAccount";
import { syncStatus } from "@/lib/account/sync";
import { nameProblem, NAME_MAX } from "@/lib/me/profile";
import { useSocial } from "@/lib/social/store";
import EditProfileSheet from "./EditProfileSheet";

const seenKey = (uid: string) => `ms_profile_prompt_${uid}`;

/** His first name from Google (or another provider), if it's usable as a name here. */
function nameFromProvider(meta: Record<string, unknown> | undefined): string | undefined {
  const raw = [meta?.given_name, meta?.full_name, meta?.name].find((v) => typeof v === "string" && v.trim()) as string | undefined;
  const first = raw?.trim().split(/\s+/)[0]?.slice(0, NAME_MAX);
  return first && !nameProblem(first) ? first : undefined;
}

export default function ProfilePrompt() {
  const acc = useAccount();
  const social = useSocial();
  const pathname = usePathname();
  const sync = useSyncExternalStore(syncStatus.subscribe, syncStatus.get, syncStatus.get);
  const [open, setOpen] = useState(false);
  const user = acc.status === "signedIn" ? acc.user : null;
  const uid = user?.id ?? null;
  const hasProfile = Boolean(social.nickname || social.profile.updatedAt || social.profile.photo);

  useEffect(() => {
    if (!uid || open || !social.ready || hasProfile) return;
    if (sync.status !== "saved") return; // wait until his account data is on this phone
    if (pathname.startsWith("/account")) return; // not on top of the sign-in screens
    try {
      if (localStorage.getItem(seenKey(uid))) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, [uid, open, social.ready, hasProfile, sync.status, pathname]);

  if (!user) return null;
  return (
    <EditProfileSheet
      open={open}
      welcome
      onClose={() => {
        try {
          localStorage.setItem(seenKey(user.id), new Date().toISOString());
        } catch {}
        setOpen(false);
      }}
      name={social.nickname}
      profile={social.profile}
      account={accountLabel(user)}
      suggestedName={nameFromProvider(user.user_metadata)}
    />
  );
}
