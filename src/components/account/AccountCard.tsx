"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CloudCheck, CloudOff, Loader2, LogOut, UserPlus, UserX } from "lucide-react";
import Sheet from "@/components/motion/Sheet";
import { useToast } from "@/components/motion/Toast";
import { account, accountLabel, type AccountState } from "@/lib/account/useAccount";
import { flushSync, stopSync, syncStatus } from "@/lib/account/sync";

const SERVER = { status: "idle" as const, lastSaved: null };

export default function AccountCard({ acc }: { acc: AccountState }) {
  const showToast = useToast();
  const sync = useSyncExternalStore(syncStatus.subscribe, syncStatus.get, () => SERVER);
  const [sheet, setSheet] = useState<"signout" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (acc.status === "loading") return <div className="h-28 animate-pulse rounded-3xl bg-surface ring-1 ring-line" />;

  if (acc.status !== "signedIn") {
    return (
      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
        <div className="flex gap-3">
          <UserPlus size={18} className="mt-0.5 shrink-0 text-forest" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">You&apos;re a guest</p>
            <p className="mt-1 text-sm text-ink-soft">
              Your progress is saved on this phone only. Create a free account to keep it safe, even if you change phones.
            </p>
            {acc.status === "guest" && (
              <div className="mt-4 flex gap-2">
                <Link href="/account" className="flex-1 rounded-full bg-forest py-3 text-center text-sm font-semibold text-white">
                  Create account
                </Link>
                <Link href="/account?mode=login" className="flex-1 rounded-full py-3 text-center text-sm font-semibold ring-1 ring-line">
                  Log in
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  async function signOut() {
    setBusy(true);
    await flushSync();
    stopSync({ clearPhone: true }); // his data stays in his account, not on this phone
    await account.signOut();
    setBusy(false);
    setSheet(null);
    showToast("Signed out");
  }

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    stopSync({ clearPhone: false });
    const r = await account.deleteAccount();
    if (r.error) {
      setBusy(false);
      return setError(r.error);
    }
    stopSync({ clearPhone: true });
    window.location.href = "/";
  }

  const savedText =
    sync.status === "syncing"
      ? "Saving…"
      : sync.status === "offline"
        ? "Offline. Changes will save when you're back online."
        : sync.status === "error"
          ? "Couldn't save just now. We'll try again."
          : "Your progress is saved to your account.";

  return (
    <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Your account</p>
      <p className="mt-1 truncate font-semibold">{accountLabel(acc.user)}</p>
      <p className={`mt-2 flex items-center gap-1.5 text-xs ${sync.status === "offline" || sync.status === "error" ? "text-amber-800" : "text-forest"}`}>
        {sync.status === "syncing" ? <Loader2 size={14} className="animate-spin" /> : sync.status === "offline" || sync.status === "error" ? <CloudOff size={14} /> : <CloudCheck size={14} />}
        {savedText}
      </p>
      <div className="mt-4 flex gap-2">
        <button onClick={() => setSheet("signout")} className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-semibold ring-1 ring-line">
          <LogOut size={14} /> Sign out
        </button>
        <button onClick={() => setSheet("delete")} className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-semibold text-red-700 ring-1 ring-line">
          <UserX size={14} /> Delete account
        </button>
      </div>

      <Sheet open={sheet === "signout"} onClose={() => setSheet(null)} title="Sign out?">
        <p className="text-sm text-ink-soft">
          Your progress stays safe in your account. It will be removed from this phone, so nobody else using it can see it.
        </p>
        <button onClick={signOut} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-forest py-3 text-sm font-semibold text-white disabled:opacity-60">
          {busy && <Loader2 size={14} className="animate-spin" />} Sign out
        </button>
      </Sheet>

      <Sheet open={sheet === "delete"} onClose={() => setSheet(null)} title="Delete your account?">
        <p className="text-sm text-ink-soft">
          This deletes your login and everything saved in it: points, badges, check-ins, sleep and water records. It can&apos;t be
          undone.
        </p>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => setSheet(null)} className="rounded-full py-3 text-sm font-semibold ring-1 ring-line">
            Keep it
          </button>
          <button onClick={deleteAccount} disabled={busy} className="flex items-center justify-center gap-2 rounded-full bg-red-700 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {busy && <Loader2 size={14} className="animate-spin" />} Delete
          </button>
        </div>
      </Sheet>
    </section>
  );
}
