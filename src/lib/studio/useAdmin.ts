"use client";

// Who is signed in to the Content Studio, and are they an admin?
// The database decides: only people in the `admins` table can read their own row there.
// Staff must also pass a second step (a 6-digit code from an authenticator app). After migration 0007
// the database refuses every admin action without it, so a stolen password alone isn't enough.

import { useCallback, useEffect, useState } from "react";
import { getSupabase, supabaseConfigured } from "../supabase/client";
import { leaveTo } from "../ui/leave";
import { toLoginEmail } from "./username";
import { isRole, type AdminRole } from "../admin/perms";
import { formatWait, recordFailure, recordSuccess, waitSeconds } from "../security/loginGuard";

export type AdminState =
  | { status: "unconfigured" }
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "notAdmin"; email: string }
  /** Staff, password OK, but no authenticator app set up yet */
  | { status: "mfaSetup"; email: string }
  /** Staff, password OK: now the 6-digit code */
  | { status: "mfaCode"; email: string; factorId: string }
  | { status: "admin"; email: string; userId: string; role: AdminRole; displayName: string | null }
  | { status: "error"; message: string };

export function useAdmin() {
  const [state, setState] = useState<AdminState>(
    supabaseConfigured ? { status: "loading" } : { status: "unconfigured" },
  );

  const check = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return setState({ status: "unconfigured" });
    const { data } = await sb.auth.getSession();
    const user = data.session?.user;
    if (!user) return setState({ status: "signedOut" });

    // Staff? (my_admin_role arrives with 0007 and answers even before the second step)
    const pre = await sb.rpc("my_admin_role");
    const preRole = pre.error ? null : (pre.data as string | null);
    const staffKnown = !pre.error;
    if (staffKnown && !isRole(preRole)) return setState({ status: "notAdmin", email: user.email ?? "" });

    // The second step: password alone isn't enough for staff
    const aal = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal.data?.currentLevel !== "aal2") {
      const f = await sb.auth.mfa.listFactors();
      const app = f.data?.totp?.[0];
      // Before 0007 we can't ask the database if he's staff yet, so check the old way first
      if (!staffKnown) {
        const old = await sb.from("admins").select("role").eq("user_id", user.id).maybeSingle();
        if (!old.data || !isRole((old.data as { role?: string }).role)) return setState({ status: "notAdmin", email: user.email ?? "" });
      }
      return setState(app ? { status: "mfaCode", email: user.email ?? "", factorId: app.id } : { status: "mfaSetup", email: user.email ?? "" });
    }

    // display_name arrives with migration 0006; fall back to role only before it's run
    let res = await sb.from("admins").select("role, display_name").eq("user_id", user.id).maybeSingle();
    if (res.error && /display_name/.test(res.error.message)) res = await sb.from("admins").select("role").eq("user_id", user.id).maybeSingle();
    const { data: row, error } = res as { data: { role?: string; display_name?: string | null } | null; error: { message: string } | null };
    if (error) return setState({ status: "error", message: error.message });
    if (!row || !isRole(row.role)) return setState({ status: "notAdmin", email: user.email ?? "" });
    setState({ status: "admin", email: user.email ?? "", userId: user.id, role: row.role, displayName: row.display_name ?? null });
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    void check();
    const { data } = sb.auth.onAuthStateChange(() => void check());
    return () => data.subscription.unsubscribe();
  }, [check]);

  const signIn = useCallback(async (login: string, password: string, captchaToken?: string): Promise<string | null> => {
    const sb = getSupabase();
    if (!sb) return "Supabase isn't connected.";
    const email = toLoginEmail(login);
    const wait = waitSeconds("studio", email);
    if (wait) return `Too many wrong tries. Wait ${formatWait(wait)} and try again.`;
    const { error } = await sb.auth.signInWithPassword({ email, password, options: { captchaToken } });
    if (!error) {
      recordSuccess("studio", email);
      return null;
    }
    if (/invalid login/i.test(error.message)) {
      const w = recordFailure("studio", email);
      return w ? `Too many wrong tries. Wait ${formatWait(w)} and try again.` : "Wrong username or password.";
    }
    if (/captcha/i.test(error.message)) return "Please complete the check that you're a person, then try again.";
    if (/banned/i.test(error.message)) return "This account is restricted. Ask an owner.";
    if (/fetch|network/i.test(error.message)) return "Can't reach Supabase. Check your internet and try again.";
    return error.message;
  }, []);

  // Back to the Welcome page, with the screen covered so the Studio log-in doesn't flash first
  const signOut = useCallback(async () => {
    await leaveTo("/", async () => {
      await getSupabase()?.auth.signOut();
    });
  }, []);

  // ---- Second step (authenticator app) ----

  /** Start setting up: returns the QR code to scan and the key to type in by hand. */
  const startSetup = useCallback(async (): Promise<{ factorId: string; qr: string; secret: string } | { error: string }> => {
    const sb = getSupabase();
    if (!sb) return { error: "Supabase isn't connected." };
    // Clear a half-finished setup from before (otherwise Supabase refuses a new one)
    const f = await sb.auth.mfa.listFactors();
    for (const old of f.data?.all ?? []) if (old.factor_type === "totp" && old.status !== "verified") await sb.auth.mfa.unenroll({ factorId: old.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `Studio ${new Date().toISOString().slice(0, 10)}` });
    if (error || !data) return { error: /disabled|not enabled/i.test(error?.message ?? "") ? "Two-step sign-in is switched off in Supabase (Authentication → Multi-Factor → TOTP)." : error?.message ?? "Couldn't start set-up." };
    return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
  }, []);

  /** Check a 6-digit code (for set-up or sign-in). On success the session becomes "aal2" and the Studio opens. */
  const verifyCode = useCallback(async (factorId: string, code: string): Promise<string | null> => {
    const sb = getSupabase();
    if (!sb) return "Supabase isn't connected.";
    const who = `mfa:${factorId}`;
    const wait = waitSeconds("studio", who);
    if (wait) return `Too many wrong codes. Wait ${formatWait(wait)} and try again.`;
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (!error) {
      recordSuccess("studio", who);
      await check();
      return null;
    }
    const w = recordFailure("studio", who);
    if (w) return `Too many wrong codes. Wait ${formatWait(w)} and try again.`;
    return /invalid|expired/i.test(error.message) ? "That code is wrong or expired. Check the time on your phone and use the newest code." : error.message;
  }, [check]);

  return { state, signIn, signOut, refresh: check, startSetup, verifyCode };
}
