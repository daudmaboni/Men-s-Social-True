"use client";

import { useEffect } from "react";
import { useAccount } from "@/lib/account/useAccount";
import { isNewAccount, rememberAccount, takeOAuthPending } from "@/lib/account/known";
import { useToast } from "@/components/motion/Toast";
import { useT } from "@/lib/i18n";
import { startSync, stopSync } from "@/lib/account/sync";
import { touchActivity } from "@/lib/analytics/track";

/** Invisible: when a man is signed in, keeps his phone and account in step. */
export default function AccountSync() {
  const acc = useAccount();
  const showToast = useToast();
  const t = useT();
  const user = acc.status === "signedIn" ? acc.user : null;
  const userId = user?.id ?? null;

  // Remember this phone has a member (Welcome page says "Welcome back"), and greet him after Google:
  // a brand-new account gets "ready", a returning man gets "welcome back".
  useEffect(() => {
    if (!user) return;
    rememberAccount(user);
    if (!takeOAuthPending()) return;
    const name = (user.user_metadata?.given_name as string | undefined)?.trim();
    if (isNewAccount(user)) showToast(t("Your free account is ready. Welcome!"));
    else showToast(name ? t("Welcome back, {name}!", { name }) : t("Welcome back!"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (userId) {
      void startSync(userId);
      touchActivity(); // counts him as active today (day only, nothing else)
    }
    else if (acc.status === "guest") stopSync({ clearPhone: false });
  }, [userId, acc.status]);
  return null;
}
