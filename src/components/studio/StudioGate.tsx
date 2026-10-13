"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, LogOut, ShieldAlert } from "lucide-react";
import { useAdmin } from "@/lib/studio/useAdmin";

export type StudioAdmin = {
  email: string;
  userId: string;
  role: "owner" | "editor";
};

/** Shows the Studio only to signed-in admins. Everyone else sees the sign-in form or a clear message. */
export default function StudioGate({
  children,
}: {
  children: (admin: StudioAdmin) => React.ReactNode;
}) {
  const { state, signIn, signOut } = useAdmin();

  return (
    <div className="rise space-y-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/studio" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-sm font-bold text-mint">
            MS
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Content Studio</p>
            <p className="text-[11px] text-ink-soft">
              {state.status === "admin"
                ? `${state.email} · ${state.role}`
                : "Men's Social · staff only"}
            </p>
          </div>
        </Link>
        {(state.status === "admin" || state.status === "notAdmin") && (
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-ink-soft ring-1 ring-line"
          >
            <LogOut size={14} /> Sign out
          </button>
        )}
      </header>

      {state.status === "loading" && (
        <div className="flex justify-center py-20 text-ink-soft">
          <Loader2 className="animate-spin" />
        </div>
      )}

      {state.status === "unconfigured" && (
        <Notice title="Supabase isn't connected">
          Add <code>.env.local</code> with <code>NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> next to package.json,
          then stop and restart <code>npx next dev</code>.
        </Notice>
      )}

      {state.status === "error" && (
        <Notice title="Something went wrong">{state.message}</Notice>
      )}

      {state.status === "signedOut" && <LoginForm onSignIn={signIn} />}

      {state.status === "notAdmin" && (
        <Notice title="No Studio access">
          {state.email} is signed in, but isn&apos;t a Studio admin. Ask the
          owner to add this account.
        </Notice>
      )}

      {state.status === "admin" &&
        children({
          email: state.email,
          userId: state.userId,
          role: state.role,
        })}
    </div>
  );
}

function LoginForm({
  onSignIn,
}: {
  onSignIn: (email: string, password: string) => Promise<string | null>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await onSignIn(email, password);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto max-w-sm space-y-4 rounded-3xl bg-surface p-6 ring-1 ring-line"
    >
      <div>
        <h1 className="text-xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-ink-soft">
          For Kayani staff who add and publish content.
        </p>
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-ink-soft">Email</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
      {error && (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-forest py-3.5 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {busy && <Loader2 size={16} className="animate-spin" />} Sign in
      </button>
    </form>
  );
}

export function Notice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-sm gap-3 rounded-3xl bg-surface p-5 ring-1 ring-line">
      <ShieldAlert size={18} className="mt-0.5 shrink-0 text-forest" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-ink-soft">{children}</p>
      </div>
    </div>
  );
}
