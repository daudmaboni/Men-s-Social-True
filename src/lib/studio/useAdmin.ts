"use client";

// Who is signed in to the Content Studio, and are they an admin?
// The database decides: only people in the `admins` table can read their own row there.

import { useCallback, useEffect, useState } from "react";
import { getSupabase, supabaseConfigured } from "../supabase/client";
import { toLoginEmail } from "./username";
import { isRole, type AdminRole } from "../admin/perms";

export type AdminState =
  | { status: "unconfigured" }
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "notAdmin"; email: string }
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

  const signIn = useCallback(async (login: string, password: string): Promise<string | null> => {
    const sb = getSupabase();
    if (!sb) return "Supabase isn't connected.";
    const { error } = await sb.auth.signInWithPassword({ email: toLoginEmail(login), password });
    if (!error) return null;
    if (/invalid login/i.test(error.message)) return "Wrong username or password.";
    if (/banned/i.test(error.message)) return "This account is restricted. Ask an owner.";
    if (/fetch|network/i.test(error.message)) return "Can't reach Supabase. Check your internet and try again.";
    return error.message;
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
  }, []);

  return { state, signIn, signOut, refresh: check };
}
