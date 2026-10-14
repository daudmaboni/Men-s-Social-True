"use client";

// The live Discover layout for the men's app: read from Supabase (homepage_configs, state = published),
// remembered on the phone so Discover opens instantly and offline, refreshed when the app comes back to the front.
// If the database isn't updated yet (or anything fails), the normal Discover page is used.

import { useEffect, useSyncExternalStore } from "react";
import { getSupabase } from "../supabase/client";
import { DEFAULT_CONFIG, normalizeConfig, type HomepageConfig } from "./config";

const KEY = "ms_homepage_v1";
let current: HomepageConfig | null = null;
let lastFetch = 0;
const listeners = new Set<() => void>();

function read(): HomepageConfig {
  if (current) return current;
  try {
    const raw = localStorage.getItem(KEY);
    current = raw ? normalizeConfig(JSON.parse(raw)) : DEFAULT_CONFIG;
  } catch {
    current = DEFAULT_CONFIG;
  }
  return current;
}

async function refresh(force = false) {
  const sb = getSupabase();
  if (!sb || (!force && Date.now() - lastFetch < 30_000)) return;
  lastFetch = Date.now();
  const { data, error } = await sb.from("homepage_configs").select("config").eq("state", "published").maybeSingle();
  if (error) return; // keep what we have
  const next = data ? normalizeConfig(data.config) : DEFAULT_CONFIG;
  if (JSON.stringify(next) === JSON.stringify(read())) return;
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

export function useHomepage(): HomepageConfig {
  const config = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => DEFAULT_CONFIG,
  );
  useEffect(() => {
    void refresh(true);
    const onFocus = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  return config;
}
