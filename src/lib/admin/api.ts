"use client";

// One place where the Admin Control Center talks to Supabase.
// Every call goes through the database's own permission checks (0006); errors come back as plain sentences.

import { getSupabase } from "../supabase/client";

export const NEEDS_0006 = "This part needs the Admin Control Center database update. Run supabase/migrations/0006_admin_control_center.sql in Supabase → SQL Editor.";

export class AdminError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

/** Turns a Supabase/PostgREST error into something an admin can act on. */
export function friendly(e: { message?: string; code?: string } | null | undefined): AdminError {
  const msg = e?.message ?? "Something went wrong.";
  if (e?.code === "PGRST202" || /could not find the function|schema cache/i.test(msg)) return new AdminError(NEEDS_0006, "missing");
  if (e?.code === "42P01" || /relation .* does not exist/i.test(msg)) return new AdminError(NEEDS_0006, "missing");
  if (/failed to fetch|network/i.test(msg)) return new AdminError("Can't reach Supabase. Check your internet and try again.", "network");
  if (e?.code === "42501" || /row-level security|permission denied/i.test(msg)) {
    return new AdminError(msg.startsWith("Not allowed") ? msg : "Not allowed: your admin role can't do this.", "forbidden");
  }
  return new AdminError(msg, e?.code);
}

function client() {
  const sb = getSupabase();
  if (!sb) throw new AdminError("Supabase isn't connected, so this needs the online database.", "unconfigured");
  return sb;
}

/** Call a database function. */
export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client().rpc(fn, args);
  if (error) throw friendly(error);
  return data as T;
}

/** Read rows from a table the admin is allowed to see (row-level security decides). */
export async function select<T>(
  table: string,
  columns = "*",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build: (q: any) => any = (q) => q,
): Promise<T[]> {
  const { data, error } = await build(client().from(table).select(columns));
  if (error) throw friendly(error);
  return (data ?? []) as T[];
}

export const db = () => client();
