"use client";

// "Share my records with Kayani support" (Step 65). He turns it on in Me → Settings.
// While it's on, an owner can open his check-ins, sleep, water, notes and profile on Admin → Users
// (each look is logged). Off by default; turning it off closes access at once (the database checks it).

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "../supabase/client";

export interface SupportShare {
  ready: boolean;
  /** When he turned it on, or null when it's off. */
  sharedAt: string | null;
  /** False when the database doesn't have the switch yet (migration 0012). */
  available: boolean;
  set: (on: boolean) => Promise<void>;
}

export function useSupportShare(userId: string | null): SupportShare {
  const [state, setState] = useState<{ ready: boolean; sharedAt: string | null; available: boolean }>({ ready: false, sharedAt: null, available: true });

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !userId) {
      setState({ ready: true, sharedAt: null, available: false });
      return;
    }
    let live = true;
    void sb
      .from("support_shares")
      .select("shared_at")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (live) setState({ ready: true, sharedAt: data?.shared_at ?? null, available: !error });
      });
    return () => {
      live = false;
    };
  }, [userId]);

  const set = useCallback(
    async (on: boolean) => {
      const sb = getSupabase();
      if (!sb || !userId) throw new Error("Not signed in");
      if (on) {
        const { data, error } = await sb.from("support_shares").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true }).select("shared_at").maybeSingle();
        if (error) throw new Error(error.message);
        setState((s) => ({ ...s, sharedAt: data?.shared_at ?? new Date().toISOString() }));
      } else {
        const { error } = await sb.from("support_shares").delete().eq("user_id", userId);
        if (error) throw new Error(error.message);
        setState((s) => ({ ...s, sharedAt: null }));
      }
    },
    [userId],
  );

  return { ...state, set };
}
