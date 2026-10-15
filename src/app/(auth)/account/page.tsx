"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { useToast } from "@/components/motion/Toast";
import { account, AUTH_METHODS, useAccount } from "@/lib/account/useAccount";
import { useT } from "@/lib/i18n";
import PasswordMeter from "@/components/security/PasswordMeter";
import AuthScreen from "@/components/auth/AuthScreen";
import Captcha, { captchaOn, type CaptchaHandle } from "@/components/security/Captcha";

type Mode = "signup" | "login" | "reset";
/** First the list of ways in (Google, phone, email); tapping one opens its own form. */
type View = "choose" | "email" | "phone";

export default function AccountPage() {
  return (
    <Suspense>
      <AccountInner />
    </Suspense>
  );
}

function AccountInner() {
  const router = useRouter();
  const params = useSearchParams();
  const showToast = useToast();
  const acc = useAccount();
  const t = useT();
  // Log in is the default; "Create free account" buttons elsewhere open ?mode=signup
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "login");
  const [view, setView] = useState<View>("choose");

  // Where to go after signing in: ?next=/man from the welcome screen, otherwise Me
  const next = params.get("next");
  const afterSignIn = next && next.startsWith("/") && !next.startsWith("//") ? next : "/me";
  const done = (msg: string) => {
    showToast(t(msg));
    router.push(afterSignIn);
  };

  if (acc.status === "signedIn") {
    return (
      <Shell>
        <div className="py-2 text-center">
          <p className="font-semibold">{t("You're signed in")}</p>
          <Link href={afterSignIn} className="mt-4 inline-block rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white">
            {t("Continue")}
          </Link>
        </div>
      </Shell>
    );
  }
  if (acc.status === "unavailable") {
    return (
      <Shell>
        <p className="py-2 text-center text-sm text-ink-soft">{t("Accounts aren't switched on yet. You can keep using the app as a guest.")}</p>
      </Shell>
    );
  }

  const signup = mode === "signup";
  const switchMode = (m: Mode) => {
    setMode(m);
    if (m !== "reset" && view === "phone") setView("choose");
  };

  return (
    <Shell back={view === "choose" ? null : () => { setView("choose"); if (mode === "reset") setMode("login"); }} backLabel={signup ? "Other ways to sign up" : "Other ways to log in"}>
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t(mode === "reset" ? "Reset your password" : signup ? "Create your free account" : "Welcome back")}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {t(
            mode === "reset"
              ? "We'll email you a link to choose a new password."
              : signup
                ? "Keep your points, badges and progress safe, even if you change phones. Only you can see your data."
                : "Log in to see your points, badges and progress.",
          )}
        </p>
      </div>

      {view === "choose" && (
        <div key={mode} className="page-enter space-y-2.5">
          <button
            onClick={async () => {
              const r = await account.signInGoogle(afterSignIn);
              if (r.error) showToast(t(r.error));
            }}
            disabled={!AUTH_METHODS.google}
            className={way}
          >
            <GoogleMark /> {t("Continue with Google")}
            {!AUTH_METHODS.google && <Soon />}
          </button>
          <button onClick={() => setView("phone")} disabled={!AUTH_METHODS.phone} className={way}>
            <Smartphone size={18} className="text-forest" /> {t("Continue with phone number")}
            {!AUTH_METHODS.phone && <Soon />}
          </button>
          <button onClick={() => setView("email")} className={way}>
            <Mail size={18} className="text-forest" /> {t("Continue with email")}
          </button>
        </div>
      )}

      {view === "email" && (
        <div className="page-enter">
          <EmailForm mode={mode} onMode={switchMode} onDone={done} />
        </div>
      )}
      {view === "phone" && AUTH_METHODS.phone && (
        <div className="page-enter">
          <PhoneForm onDone={() => done("Signed in · your progress is saved")} />
        </div>
      )}

      {/* Log in ⇄ Create account */}
      {mode !== "reset" && (
        <p className="text-center text-sm text-ink-soft">
          {t(signup ? "Already have an account?" : "Don't have an account?")}{" "}
          <button onClick={() => switchMode(signup ? "login" : "signup")} className="font-semibold text-forest">
            {t(signup ? "Log in" : "Create one")}
          </button>
        </p>
      )}

      <p className="flex items-start gap-2 px-1 text-xs text-ink-soft">
        <Lock size={13} className="mt-0.5 shrink-0 text-forest" />
        {t("Your check-ins and notes are private. Kayani staff can't read them, and we never use them for adverts.")}
      </p>

      {/* For Kayani staff: the Admin Control Center has its own sign-in (with an authenticator code) */}
      {view === "choose" && (
        <Link
          href="/studio"
          className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-xs ring-1 ring-line transition-colors hover:bg-surface"
        >
          <span className="flex items-center gap-2 text-ink-soft">
            <ShieldCheck size={15} className="text-forest" />
            {t("Kayani staff?")} <span className="font-semibold text-ink">{t("Open the Studio")}</span>
          </span>
          <ChevronRight size={15} className="text-ink-soft" />
        </Link>
      )}
    </Shell>
  );
}

const way =
  "flex w-full items-center justify-center gap-3 rounded-full bg-surface py-3.5 text-sm font-semibold ring-1 ring-line transition-transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100";

function Soon() {
  const t = useT();
  return <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] text-ink-soft ring-1 ring-line">{t("Soon")}</span>;
}

function EmailForm({ mode, onMode, onDone }: { mode: Mode; onMode: (m: Mode) => void; onDone: (msg: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const captchaBox = useRef<CaptchaHandle>(null);
  const t = useT();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (captchaOn && !captcha) return setError(t("Please complete the check that you're a person, then try again."));
    setBusy(true);
    setError(null);
    const token = captcha ?? undefined;
    captchaBox.current?.reset(); // each check works once
    if (mode === "reset") {
      const r = await account.resetPassword(email, token);
      setBusy(false);
      if (r.error) return setError(t(r.error, r.vars));
      return setSent("If that email has an account, a reset link is on its way. Check your inbox.");
    }
    const r = mode === "signup" ? await account.signUpEmail(email, password, token) : await account.signInEmail(email, password, token);
    setBusy(false);
    if (r.error) return setError(t(r.error, r.vars));
    if (r.needsConfirm) return setSent("Almost done. We sent you an email: tap the link in it to finish creating your account.");
    onDone(mode === "signup" ? "Account created · your progress is saved" : "Welcome back");
  }

  if (sent) {
    return (
      <div className="rounded-3xl bg-mint/60 p-5 text-sm text-forest-deep">
        <Mail size={20} className="mb-2 text-forest" />
        {t(sent)}
        <button onClick={() => { setSent(null); onMode("login"); }} className="mt-3 block font-semibold text-forest">
          {t("Back to log in")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="text-xs font-semibold text-ink-soft">{t("Email")}</span>
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
      </label>
      {mode !== "reset" && (
        <label className="block">
          <span className="text-xs font-semibold text-ink-soft">{t("Password")}</span>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={mode === "signup" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${input} pr-11`}
            />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={t(show ? "Hide password" : "Show password")} className="absolute inset-y-0 right-0 mt-1 flex w-11 items-center justify-center text-ink-soft">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {mode === "signup" && <PasswordMeter password={password} email={email} lang={t.lang} />}
        </label>
      )}
      <Captcha ref={captchaBox} onToken={setCaptcha} lang={t.lang} />
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-forest py-3.5 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60">
        {busy && <Loader2 size={16} className="animate-spin" />}
        {t(mode === "signup" ? "Create account" : mode === "login" ? "Log in" : "Send reset link")}
      </button>
      <div className="flex justify-between text-xs font-semibold text-forest">
        {mode === "login" && (
          <button type="button" onClick={() => onMode("reset")}>
            {t("Forgot password?")}
          </button>
        )}
        {mode === "reset" && (
          <button type="button" onClick={() => onMode("login")}>
            {t("Back to log in")}
          </button>
        )}
      </div>
    </form>
  );
}

function PhoneForm({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const captchaBox = useRef<CaptchaHandle>(null);
  const t = useT();

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (captchaOn && !captcha) return setError(t("Please complete the check that you're a person, then try again."));
    setBusy(true);
    setError(null);
    const r = await account.sendPhoneCode(phone, captcha ?? undefined);
    captchaBox.current?.reset();
    setBusy(false);
    if (r.error) return setError(t(r.error, r.vars));
    setSentTo(r.phone ?? null);
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    const r = await account.verifyPhoneCode(sentTo, code);
    setBusy(false);
    if (r.error) return setError(t(r.error, r.vars));
    onDone();
  }

  return (
    <form onSubmit={sentTo ? verify : send} className="space-y-3 rounded-3xl bg-surface p-4 ring-1 ring-line">
      {sentTo ? (
        <label className="block">
          <span className="text-xs font-semibold text-ink-soft">{t("Code sent by SMS to {phone}", { phone: sentTo })}</span>
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={`${input} text-center text-lg tracking-[0.5em]`} />
        </label>
      ) : (
        <label className="block">
          <span className="text-xs font-semibold text-ink-soft">{t("Mobile number")}</span>
          <input type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
        </label>
      )}
      {!sentTo && <Captcha ref={captchaBox} onToken={setCaptcha} lang={t.lang} />}
      {error && <p role="alert" className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-forest py-3 text-sm font-semibold text-white disabled:opacity-60">
        {busy && <Loader2 size={16} className="animate-spin" />}
        {t(sentTo ? "Confirm code" : "Send me a code")}
      </button>
      {sentTo && (
        <button type="button" onClick={() => { setSentTo(null); setCode(""); }} className="w-full text-xs font-semibold text-forest">
          {t("Use a different number")}
        </button>
      )}
    </form>
  );
}

/** A frosted-glass card in the middle of the screen (phone and computer). X goes back to the welcome page. */
function Shell({ children, back, backLabel }: { children: React.ReactNode; back?: (() => void) | null; backLabel?: string }) {
  const t = useT();
  return (
    <AuthScreen closeHref="/" closeLabel={t("Close")}>
      <div className="stagger space-y-5">
        {back && (
          <button onClick={back} className="-mb-1 flex items-center gap-1 text-sm text-ink-soft">
            <ArrowLeft size={16} /> {t(backLabel ?? "Back")}
          </button>
        )}
        {children}
      </div>
    </AuthScreen>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const input = "mt-1 w-full rounded-2xl bg-surface px-4 py-3 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-forest";
