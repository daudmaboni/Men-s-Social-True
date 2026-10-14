"use client";

import { useEffect } from "react";
import { useAccount } from "@/lib/account/useAccount";
import { startSync, stopSync } from "@/lib/account/sync";
import { touchActivity } from "@/lib/analytics/track";

/** Invisible: when a man is signed in, keeps his phone and account in step. */
export default function AccountSync() {
  const acc = useAccount();
  const userId = acc.status === "signedIn" ? acc.user.id : null;
  useEffect(() => {
    if (userId) {
      void startSync(userId);
      touchActivity(); // counts him as active today (day only, nothing else)
    }
    else if (acc.status === "guest") stopSync({ clearPhone: false });
  }, [userId, acc.status]);
  return null;
}
