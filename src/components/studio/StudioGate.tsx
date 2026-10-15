"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Eye, EyeOff, KeyRound, Loader2, LogOut, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import Captcha, { captchaOn, type CaptchaHandle } from "@/components/security/Captcha";
import type { AdminState } from "@/lib/studio/useAdmin";
import { staffName } from "@/lib/studio/username";
import type { AdminRole } from "@/lib/admin/perms";

export type StudioAdmin = {
  email: string;
  userId: string;
  role: AdminRole;
  displayName: string | null;
};

/** What staff see before they're inside: sign-in form, or a clear message. */
type SetupResult = { factorId: string; qr: string; secret: string } | { error: string };

export function GateScreen({
  state,
  onSignIn,
  onSignOut,
  onStartSetup,
  onVerify,
}: {
  state: Exclude<AdminState, { status: "admin" }>;
  onSignIn: (login: string, password: string, captchaToken?: string) => Promise<string | null>;
  onSignOut: () => void;
  onStartSetup: () => Promise<SetupResult>;
  onVerify: (factorId: string, code: string) => Promise<string | null>;
}) {
  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-5 pb-16 pt-6">
      <div className="rise space-y-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-sm font-bold text-mint">MS</div>
            <div>
              <p className="text-sm font-bold leading-tight">Admin Control Center</p>
              <p className="text-[11px] text-ink-soft">Men&apos;s Social · staff only</p>
            </div>
          </div>
          {(state.status === "notAdmin" || state.status === "mfaSetup" || state.status === "mfaCode") && (
            <button onClick={onSignOut} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-ink-soft ring-1 ring-line">
              <LogOut size={14} /> Sign out
            </button>
          )}
        </header>

        {state.status === "loading" && (
          <div className="flex justify-center py-20 text-ink-soft" aria-busy="true" aria-label="Loading">
            <Loader2 className="animate-spin" />
          </div>
        )}
        {state.status === "unconfigured" && (
          <Notice title="Supabase isn't connected">
            Add <code>.env.local</code> with <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> next to
            package.json, then stop and restart <code>npx next dev</code>.
          </Notice>
        )}
        {state.status === "error" && <Notice title="Something went wrong">{state.message}</Notice>}
        {state.status === "signedOut" && <LoginForm onSignIn={onSignIn} />}
        {state.status === "mfaSetup" && <SetupTwoStep email={state.email} onStart={onStartSetup} onVerify={onVerify} />}
        {state.status === "mfaCode" && <CodeForm email={state.email} factorId={state.factorId} onVerify={onVerify} />}
        {state.status === "notAdmin" && (
          <Notice title="No admin access">
            {staffName(state.email)} is signed in, but isn&apos;t an admin. Ask an owner to add this account in Settings → Admins.
          </Notice>
        )}
      </div>
    </main>
  );
}

function LoginForm({ onSignIn }: { onSignIn: (login: string, password: string, captchaToken?: string) => Promise<string | null> }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const captchaBox = useRef<CaptchaHandle>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (captchaOn && !captcha) return setError("Please complete the check that you're a person, then try again.");
    setBusy(true);
    setError(null);
    const err = await onSignIn(login, password, captcha ?? undefined);
    captchaBox.current?.reset();
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-4 rounded-3xl bg-surface p-6 ring-1 ring-line">
      <div>
        <h1 className="text-xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-ink-soft">For Kayani staff who run Men&apos;s Social.</p>
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-ink-soft">Username or email</span>
        <input
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="e.g. TheAdmin"
          required
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          className="mt-1 w-full rounded-2xl bg-bg px-4 py-3 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-forest"
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-ink-soft">Password</span>
        <div className="relative mt-1">
          <input
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl bg-bg px-4 py-3 pr-11 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-forest"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-soft"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </label>
      <Captcha ref={captchaBox} onToken={setCaptcha} />
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-forest py-3.5 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {busy && <Loader2 size={16} className="animate-spin" />} Sign in
      </button>
      <p className="flex items-center justify-center gap-1.5 text-[11px] text-ink-soft">
        <ShieldCheck size={12} /> Next, you&apos;ll enter a code from your authenticator app.
      </p>
    </form>
  );
}

/** First time: scan a QR code with an authenticator app, then type the 6-digit code it shows. */
function SetupTwoStep({ email, onStart, onVerify }: { email: string; onStart: () => Promise<SetupResult>; onVerify: (factorId: string, code: string) => Promise<string | null> }) {
  const [setup, setSetup] = useState<SetupResult | null>(null);
  const [showKey, setShowKey] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // once (React runs effects twice in development)
    started.current = true;
    void onStart().then(setSetup);
  }, [onStart]);

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-3xl bg-surface p-6 ring-1 ring-line">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-mint text-forest">
          <ShieldCheck size={20} />
        </span>
        <div>
          <h1 className="text-xl font-bold">Turn on two-step sign-in</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Staff accounts can see private data, so a password alone isn&apos;t enough. This is a one-time set-up for {staffName(email)}.
          </p>
        </div>
      </div>

      <ol className="space-y-1.5 text-sm">
        <li className="flex gap-2">
          <Smartphone size={16} className="mt-0.5 shrink-0 text-forest" />
          <span>
            <b>1.</b> On your phone, install an authenticator app: <b>Google Authenticator</b> or <b>Microsoft Authenticator</b> (free).
          </span>
        </li>
        <li className="pl-6">
          <b>2.</b> In the app, tap <b>+</b> and scan this code.
        </li>
        <li className="pl-6">
          <b>3.</b> Type the 6-digit code the app shows.
        </li>
      </ol>

      {!setup ? (
        <div className="flex h-48 items-center justify-center text-ink-soft" aria-busy="true" aria-label="Loading">
          <Loader2 className="animate-spin" />
        </div>
      ) : "error" in setup ? (
        <p role="alert" className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {setup.error}
        </p>
      ) : (
        <>
          <div className="flex flex-col items-center gap-2">
            {/* The QR code comes from Supabase as an image (it holds the secret, so it's never stored) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="QR code for your authenticator app" width={176} height={176} className="rounded-2xl bg-white p-2 ring-1 ring-line" />
            <button type="button" onClick={() => setShowKey((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-forest">
              <KeyRound size={13} /> {showKey ? "Hide the key" : "Can't scan? Type a key instead"}
            </button>
            {showKey && (
              <div className="flex w-full items-center gap-2 rounded-2xl bg-bg px-3 py-2">
                <code className="flex-1 break-all text-xs">{setup.secret}</code>
                <button
                  type="button"
                  aria-label="Copy key"
                  onClick={() => void navigator.clipboard?.writeText(setup.secret)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-line"
                >
                  <Copy size={14} />
                </button>
              </div>
            )}
          </div>
          <CodeInput factorId={setup.factorId} onVerify={onVerify} button="Turn on and continue" />
          <p className="text-[11px] text-ink-soft">
            Lost your phone later? The owner can reset it in Supabase → Authentication → Users → your account → remove the authenticator.
            Then you set it up again here.
          </p>
        </>
      )}
    </div>
  );
}

/** Every sign-in after set-up: the code from the app. */
function CodeForm({ email, factorId, onVerify }: { email: string; factorId: string; onVerify: (factorId: string, code: string) => Promise<string | null> }) {
  return (
    <div className="mx-auto max-w-sm space-y-4 rounded-3xl bg-surface p-6 ring-1 ring-line">
      <div>
        <h1 className="text-xl font-bold">Enter your code</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Open your authenticator app and type the 6-digit code for Men&apos;s Social ({staffName(email)}).
        </p>
      </div>
      <CodeInput factorId={factorId} onVerify={onVerify} button="Continue" />
    </div>
  );
}

function CodeInput({ factorId, onVerify, button }: { factorId: string; onVerify: (factorId: string, code: string) => Promise<string | null>; button: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return setError("The code has 6 digits.");
    setBusy(true);
    setError(null);
    const err = await onVerify(factorId, code);
    setBusy(false);
    if (err) {
      setError(err);
      setCode("");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="text-xs font-semibold text-ink-soft">6-digit code</span>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="mt-1 w-full rounded-2xl bg-bg px-4 py-3 text-center text-xl tracking-[0.5em] outline-none ring-1 ring-line focus:ring-2 focus:ring-forest"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-forest py-3.5 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {busy && <Loader2 size={16} className="animate-spin" />} {button}
      </button>
    </form>
  );
}

export function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm gap-3 rounded-3xl bg-surface p-5 ring-1 ring-line">
      <ShieldAlert size={18} className="mt-0.5 shrink-0 text-forest" />
      <div>
        <p className="font-semibold">{title}</p>
        <div className="mt-1 text-sm text-ink-soft">{children}</div>
      </div>
    </div>
  );
}
