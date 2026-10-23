"use client";

// Step 90: Me → Settings → "Lock Man and Me". Turn on with a PIN (typed twice), add fingerprint/face, change
// the PIN, or turn it off.

import { useEffect, useState } from "react";
import { Fingerprint, Lock } from "lucide-react";
import Sheet from "@/components/motion/Sheet";
import { useToast } from "@/components/motion/Toast";
import PinPad from "./PinPad";
import { privacyLock, usePrivacyLock } from "@/lib/privacy/lock";
import { useT } from "@/lib/i18n";

export default function LockSettings() {
  const t = useT();
  const showToast = useToast();
  const lock = usePrivacyLock();
  const [step, setStep] = useState<null | "new" | "again">(null);
  const [first, setFirst] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bioOk, setBioOk] = useState(false);
  useEffect(() => {
    void privacyLock.bioAvailable().then(setBioOk);
  }, []);

  const start = () => {
    setFirst("");
    setError(null);
    setStep("new");
  };
  const onPin = async (pin: string) => {
    if (step === "new") {
      setFirst(pin);
      setError(null);
      setStep("again");
      return true;
    }
    if (pin !== first) {
      setError(t("The PINs didn't match. Start again."));
      setStep("new");
      return false;
    }
    if (lock.enabled) await privacyLock.changePin(pin);
    else await privacyLock.enable(pin);
    setStep(null);
    showToast(t(lock.enabled ? "PIN changed" : "Lock on. Man and Me lock when you leave the app."));
    return true;
  };

  return (
    <div className="border-t border-line p-5">
      <div className="flex items-center gap-3">
        <Lock size={18} className="shrink-0 text-forest" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t("Lock Man and Me")}</span>
          <span className="block text-xs text-ink-soft">{t("A PIN for your progress, so nobody else sees it on this phone. Discover stays open.")}</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label={t("Lock Man and Me")}
          checked={lock.enabled}
          onChange={(e) => {
            if (e.target.checked) start();
            else {
              privacyLock.disable();
              showToast(t("Lock off"));
            }
          }}
          className="peer sr-only"
          id="privacy-lock"
        />
        <label
          htmlFor="privacy-lock"
          aria-hidden
          className="relative h-7 w-12 shrink-0 cursor-pointer rounded-full bg-line transition-colors peer-checked:bg-forest peer-focus-visible:ring-2 peer-focus-visible:ring-forest after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
        />
      </div>
      {lock.enabled && (
        <div className="mt-3 flex flex-wrap gap-2 pl-[30px]">
          <button type="button" onClick={start} className="rounded-full px-3.5 py-2 text-xs font-semibold ring-1 ring-line">
            {t("Change PIN")}
          </button>
          {bioOk && (
            <button
              type="button"
              onClick={async () => {
                if (lock.bio) {
                  privacyLock.disableBio();
                  showToast(t("Fingerprint off"));
                } else if (await privacyLock.enableBio()) showToast(t("Fingerprint on"));
                else showToast(t("Couldn't turn it on. Check the phone's screen lock is set."));
              }}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold ring-1 ${lock.bio ? "bg-mint text-forest ring-forest/40" : "ring-line"}`}
            >
              <Fingerprint size={14} /> {t(lock.bio ? "Fingerprint on" : "Use fingerprint or face")}
            </button>
          )}
          <button type="button" onClick={() => privacyLock.lockNow()} className="rounded-full px-3.5 py-2 text-xs font-semibold ring-1 ring-line">
            {t("Lock now")}
          </button>
        </div>
      )}

      <Sheet open={step !== null} onClose={() => setStep(null)} title={t(step === "again" ? "Type it again" : lock.enabled ? "New PIN" : "Choose a 4-digit PIN")}>
        <p className="mb-4 text-center text-sm text-ink-soft">{t("Pick something others won't guess. Not your birthday or 1234.")}</p>
        {step && <PinPad key={step} onDone={onPin} error={error} />}
      </Sheet>
    </div>
  );
}
