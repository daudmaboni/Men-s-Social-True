"use client";

import { useEffect, useState } from "react";
import { inviteToAccount } from "./AccountInvite";
import Link from "next/link";
import { ShieldCheck, X } from "lucide-react";
import { useAccount } from "@/lib/account/useAccount";

const KEY = "ms_nudge_account";

/** A gentle invite to create an account, once he has some progress worth keeping. He can dismiss it. */
export default function SaveProgressCard({ points }: { points: number }) {
  const acc = useAccount();
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(KEY) === "dismissed";
    } catch {
      return false;
    }
  });
  // The moment he earns his first points, invite him once
  useEffect(() => {
    if (acc.status === "guest" && points > 0) inviteToAccount("first-points");
  }, [acc.status, points]);

  if (acc.status !== "guest" || points < 20 || hidden) return null;

  return (
    <section className="relative flex gap-3 rounded-3xl bg-mint/60 p-5">
      <ShieldCheck size={20} className="mt-0.5 shrink-0 text-forest" />
      <div className="min-w-0 flex-1 pr-6">
        <p className="font-semibold text-forest-deep">Keep your {points} points safe</p>
        <p className="mt-1 text-sm text-forest">Create a free account so you don&apos;t lose your progress if you change or lose your phone.</p>
        <Link href="/account" className="mt-3 inline-block rounded-full bg-forest px-4 py-2 text-sm font-semibold text-white">
          Create free account
        </Link>
      </div>
      <button
        aria-label="Not now"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(KEY, "dismissed");
          } catch {}
        }}
        className="absolute right-3 top-3 rounded-full p-1.5 text-forest"
      >
        <X size={16} />
      </button>
    </section>
  );
}

/** Small line under the Man tab saying where his data is kept. */
export function WhereSavedNote() {
  const acc = useAccount();
  return (
    <p className="px-2 pt-2 text-center text-[11px] text-ink-soft">
      {acc.status === "signedIn"
        ? "Saved privately to your account."
        : "Saved on this phone for now. Your records move to your account when you sign up."}
    </p>
  );
}
