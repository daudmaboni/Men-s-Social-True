"use client";

// Step 90: what shows on the Man and Me tabs (and their pages) while the private lock is on.
// PIN pad, fingerprint/face if he set it up, and "Forgot PIN?".

import { useState } from "react";
import { Fingerprint, Lock } from "lucide-react";
import Sheet from "@/components/motion/Sheet";
import PinPad from "./PinPad";
import { privacyLock, usePrivacyLock } from "@/lib/privacy/lock";
import { account, useAccount } from "@/lib/account/useAccount";
import { deleteMyData } from "@/lib/me/data";
import { haptic } from "@/lib/motion/haptics";
import { useT } from "@/lib/i18n";

export default function LockScreen() {
  const t = useT();
  const lock = usePrivacyLock();
  const acc = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  const tryPin = async (pin: string) => {
    setBusy(true);
    const r = await privacyLock.unlock(pin);
    setBusy(false);
    if (r.ok) {
      haptic("success");
      setError(null);
      return true;
    }
    setError(r.wait ? t("Too many tries. Wait {n} seconds.", { n: Math.ceil(r.wait / 1000) }) : t("Wrong PIN. Try again."));
    return false;
  };

  const bio = async () => {
    const ok = await privacyLock.unlockBio();
    if (ok) haptic("success");
    else setError(t("Didn't work. Use your PIN."));
  };

  const signedIn = acc.status === "signedIn";
  const reset = async () => {
    privacyLock.disable();
    if (signedIn) {
      await account.signOut();
      window.location.href = "/account?mode=login&next=/me";
    } else {
      try {
        deleteMyData(localStorage);
      } catch {}
      window.location.href = "/";
    }
  };

  return (
    <section className="mx-auto flex min-h-[70dvh] max-w-sm flex-col items-center justify-center px-4 py-8 text-center" aria-label={t("Locked")}>
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mint text-forest">
        <Lock size={24} />
      </span>
      <h1 className="mt-3 font-display text-xl font-bold">{t("Man and Me are locked")}</h1>
      <p className="mt-1 text-sm text-ink-soft">{t("Enter your PIN to see your progress.")}</p>
      <div className="mt-6 w-full">
        <PinPad
          onDone={tryPin}
          error={error}
          busy={busy}
          extra={
            lock.bio ? (
              <button type="button" onClick={bio} aria-label={t("Use fingerprint or face")} className="flex h-16 w-16 items-center justify-center rounded-full text-forest active:scale-90">
                <Fingerprint size={30} />
              </button>
            ) : null
          }
        />
      </div>
      <button type="button" onClick={() => setForgot(true)} className="tap-target mt-5 text-sm font-semibold text-forest">
        {t("Forgot PIN?")}
      </button>

      <Sheet open={forgot} onClose={() => setForgot(false)} title={t("Forgot your PIN?")}>
        <p className="text-sm text-ink-soft">
          {signedIn
            ? t("Sign in again to remove the lock. Your progress is saved in your account, so nothing is lost.")
            : t("Without an account, the only way to remove the lock is to erase this phone's progress, points and settings. This can't be undone.")}
        </p>
        <button type="button" onClick={reset} className={`mt-4 w-full rounded-full py-3 text-sm font-bold text-white ${signedIn ? "bg-forest" : "bg-red-600"}`}>
          {t(signedIn ? "Sign in again" : "Erase and remove the lock")}
        </button>
        <button type="button" onClick={() => setForgot(false)} className="mt-2 w-full rounded-full py-3 text-sm font-semibold ring-1 ring-line">
          {t("Cancel")}
        </button>
      </Sheet>
    </section>
  );
}
