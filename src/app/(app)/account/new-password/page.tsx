"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/motion/Toast";
import { account, useAccount } from "@/lib/account/useAccount";
import { useT } from "@/lib/i18n";
import PasswordMeter from "@/components/security/PasswordMeter";

/** He arrives here from the "reset your password" email link. */
export default function NewPasswordPage() {
  const acc = useAccount();
  const router = useRouter();
  const showToast = useToast();
  const t = useT();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await account.setNewPassword(password, acc.status === "signedIn" ? acc.user.email : undefined);
    setBusy(false);
    if (r.error) return setError(t(r.error, r.vars));
    showToast(t("New password saved"));
    router.push("/me");
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t("Choose a new password")}</h1>
      {acc.status === "loading" ? (
        <Loader2 className="mx-auto animate-spin text-ink-soft" />
      ) : acc.status !== "signedIn" ? (
        <p className="rounded-3xl bg-surface p-5 text-sm text-ink-soft ring-1 ring-line">
          {t('This link has expired. Go to Me → Log in → "Forgot password?" to get a new one.')}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            aria-label={t("New password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl bg-surface px-4 py-3 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-forest"
          />
          <PasswordMeter password={password} email={acc.user.email} lang={t.lang} />
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="w-full rounded-full bg-forest py-3.5 text-sm font-semibold text-white disabled:opacity-60">
            {t("Save password")}
          </button>
        </form>
      )}
    </div>
  );
}
