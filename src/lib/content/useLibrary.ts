"use client";

// The content men see: built-in items + everything published in the Content Studio.
// Loads once, keeps a copy for offline use, and refreshes when the Studio publishes.

import { useEffect, useState } from "react";
import { LIBRARY } from "./library";
import { getContentRepo } from "./repo";
import { mergeLibrary } from "./rows";
import type { ContentItem } from "./types";

const CACHE_KEY = "ms_content_cache_v1";

type State = { items: ContentItem[]; ready: boolean; error: string | null };

let published: ContentItem[] | null = null;
let loading: Promise<void> | null = null;
let lastError: string | null = null;
const listeners = new Set<() => void>();

function readCache(): ContentItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as ContentItem[]) : null;
  } catch {
    return null;
  }
}

function load(force = false) {
  if (loading && !force) return loading;
  loading = getContentRepo()
    .listPublished()
    .then((items) => {
      published = items;
      lastError = null;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(items));
      } catch {}
    })
    .catch((e: Error) => {
      lastError = e.message;
      published = published ?? readCache() ?? [];
    })
    .finally(() => listeners.forEach((l) => l()));
  return loading;
}

function current(): State {
  return {
    items: mergeLibrary(LIBRARY, published ?? []),
    ready: published !== null,
    error: lastError,
  };
}

export function useLibrary(): State {
  // First render: built-in content straight away (no flash of empty screens)
  const [state, setState] = useState<State>(() => ({ items: LIBRARY.map((c) => ({ ...c, builtIn: true })), ready: false, error: null }));

  useEffect(() => {
    const update = () => setState(current());
    listeners.add(update);
    if (published === null) {
      const cached = readCache();
      if (cached) setState({ items: mergeLibrary(LIBRARY, cached), ready: false, error: null });
      load();
    } else {
      update();
    }
    const unsub = getContentRepo().subscribe(() => load(true));
    return () => {
      listeners.delete(update);
      unsub();
    };
  }, []);

  return state;
}

/** Fetch the published content again now (pull to refresh, Step 77). */
export function refreshLibrary(): Promise<void> {
  return load(true);
}
