"use client";

import { useEffect } from "react";
import { useAccount } from "@/lib/account/useAccount";
import { startSync, stopSync } from "@/lib/account/sync";

/** Invisible: when a man is signed in, keeps his phone and account in step. */
export default function AccountSync() {
  const acc = useAccount();
  const userId = acc.status === "signedIn" ? acc.user.id : null;
  useEffect(() => {
    if (userId) void startSync(userId);
    else if (acc.status === "guest") stopSync({ clearPhone: false });
  }, [userId, acc.status]);
  return null;
}
