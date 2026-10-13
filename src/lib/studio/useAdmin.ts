"use client";

// Who is signed in to the Content Studio, and are they an admin?
// The database decides: only people in the `admins` table can read their own row there.

import { useCallback, useEffect, useState } from "react";
import { getSupabase, supabaseConfigured } from "../supabase/client";

export type AdminState =
  | { status: "unconfigured" }
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "notAdmin"; email: string }
  | { status: "admin"; email: string; userId: string; role: "owner" | "editor" }
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

    const { data: row, error } = await sb.from("admins").select("role").eq("user_id", user.id).maybeSingle();
    if (error) return setState({ status: "error", message: error.message });
    if (!row) return setState({ status: "notAdmin", email: user.email ?? "" });
    setState({ status: "admin", email: user.email ?? "", userId: user.id, role: row.role });
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    void check();
    const { data } = sb.auth.onAuthStateChange(() => void check());
    return () => data.subscription.unsubscribe();
  }, [check]);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const sb = getSupabase();
    if (!sb) return "Supabase isn't connected.";
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (!error) return null;
    if (/invalid login/i.test(error.message)) return "Wrong email or password.";
    if (/fetch|network/i.test(error.message)) return "Can't reach Supabase. Check your internet and try again.";
    return error.message;
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
  }, []);

  return { state, signIn, signOut };
}
