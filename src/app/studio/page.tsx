"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, FileText, Loader2, LogOut, PenLine, ShieldAlert, ShieldCheck } from "lucide-react";
import { useAdmin } from "@/lib/studio/useAdmin";
import { getSupabase } from "@/lib/supabase/client";
import { LIBRARY } from "@/lib/content/library";

export default function StudioPage() {
  const { state, signIn, signOut } = useAdmin();

  return (
    <div className="rise space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-sm font-bold text-mint">MS</div>
          <div>
            <p className="text-sm font-bold leading-tight">Content Studio</p>
            <p className="text-[11px] text-ink-soft">Men&apos;s Social · staff only</p>
          </div>
        </div>
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
        <Notice icon={<ShieldAlert size={18} />} title="Supabase isn't connected">
          Add <code>.env.local</code> with <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> next to package.json, then stop and restart{" "}
          <code>npx next dev</code>.
        </Notice>
      )}

      {state.status === "error" && (
        <Notice icon={<ShieldAlert size={18} />} title="Something went wrong">
          {state.message}
        </Notice>
      )}

      {state.status === "signedOut" && <LoginForm onSignIn={signIn} />}

      {state.status === "notAdmin" && (
        <Notice icon={<ShieldAlert size={18} />} title="No Studio access">
          {state.email} is signed in, but isn&apos;t a Studio admin. Ask the owner to add this account.
        </Notice>
      )}

      {state.status === "admin" && <Overview email={state.email} role={state.role} />}
    </div>
  );
}

function LoginForm({ onSignIn }: { onSignIn: (email: string, password: string) => Promise<string | null> }) {
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
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-4 rounded-3xl bg-surface p-6 ring-1 ring-line">
      <div>
        <h1 className="text-xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-ink-soft">For Kayani staff who add and publish content.</p>
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
    </form>
  );
}

function Overview({ email, role }: { email: string; role: "owner" | "editor" }) {
  const [counts, setCounts] = useState<{ published: number; draft: number; archived: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSupabase()!
      .from("content_items")
      .select("status")
      .then(({ data, error }) => {
        if (error) return setError(error.message);
        const c = { published: 0, draft: 0, archived: 0 };
        for (const r of data ?? []) c[r.status as keyof typeof c]++;
        setCounts(c);
      });
  }, []);

  return (
    <div className="stagger space-y-4">
      <div className="rounded-3xl bg-forest p-6 text-white">
        <p className="flex items-center gap-1.5 text-xs text-mint">
          <ShieldCheck size={14} /> Signed in as {role}
        </p>
        <h1 className="mt-1 text-2xl font-bold">Karibu tena</h1>
        <p className="mt-1 text-sm text-white/80">{email}</p>
      </div>

      {error && <Notice icon={<ShieldAlert size={18} />} title="Couldn't load content">{error}</Notice>}

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Published" value={counts?.published} />
        <Stat label="Drafts" value={counts?.draft} />
        <Stat label="Archived" value={counts?.archived} />
      </div>

      <div className="flex items-start gap-3 rounded-3xl bg-surface p-5 ring-1 ring-line">
        <FileText size={18} className="mt-0.5 shrink-0 text-forest" />
        <p className="text-sm text-ink-soft">
          The app also has <b className="text-ink">{LIBRARY.length} built-in items</b> (samples and the adapted Instagram posts).
          They stay until you replace them with your own.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-3xl bg-mint/60 p-5">
        <PenLine size={18} className="mt-0.5 shrink-0 text-forest" />
        <p className="text-sm text-forest-deep">
          Next step: the content list and the editor, where you write, add a photo and publish.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-3xl bg-surface p-4 text-center ring-1 ring-line">
      <p className="text-2xl font-bold">{value ?? "–"}</p>
      <p className="text-xs text-ink-soft">{label}</p>
    </div>
  );
}

function Notice({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm gap-3 rounded-3xl bg-surface p-5 ring-1 ring-line">
      <span className="mt-0.5 shrink-0 text-forest">{icon}</span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-ink-soft">{children}</p>
      </div>
    </div>
  );
}
