// Men's Social service worker (Step 67): lets the app open, and saved guides and lessons work, with no internet.
// - App files (/_next/static, fonts, icons): kept after the first download (their names change with each release).
// - Pages: always fresh from the internet; the last copy is kept and shown when offline.
// - Card photos from Supabase: shown from the phone when offline.
// - Never kept: the Studio, /api, sign-in and anything that isn't a plain GET.
// Downloaded lesson files are stored by the app itself (lib/offline/downloads.ts) in "ms-offline-v1".

const ASSETS = "ms-assets-v1";
const PAGES = "ms-pages-v1";
const OFFLINE = "ms-offline-v1";
const KEEP = [ASSETS, PAGES, OFFLINE];
const SHELL = ["/offline.html", "/manifest.webmanifest", "/brand/icon-192.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(ASSETS).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith("ms-") && !KEEP.includes(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) (await caches.open(ASSETS)).put(request, res.clone());
  return res;
}

async function page(request) {
  try {
    const res = await fetch(request);
    if (res.ok && res.type === "basic") (await caches.open(PAGES)).put(request, res.clone());
    return res;
  } catch {
    return (
      (await caches.match(request, { ignoreSearch: true })) ||
      (await caches.match("/offline.html")) ||
      new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } })
    );
  }
}

async function photo(request) {
  try {
    const res = await fetch(request);
    if (res.ok || res.type === "opaque") (await caches.open(ASSETS)).put(request, res.clone());
    return res;
  } catch {
    const hit = await caches.match(request);
    if (hit) return hit;
    throw new Error("offline");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    const p = url.pathname;
    if (p.startsWith("/api/") || p.startsWith("/studio") || p.startsWith("/auth") || p.startsWith("/__offline/")) return;
    if (p.startsWith("/_next/static/") || p.startsWith("/fonts/") || p.startsWith("/brand/")) {
      event.respondWith(cacheFirst(request));
      return;
    }
    // Moving between pages inside the app: if this fails, the app opens the page fully (served below)
    if (request.headers.get("RSC") === "1") return;
    if (request.mode === "navigate") {
      event.respondWith(page(request));
      return;
    }
    event.respondWith(fetch(request).catch(async () => (await caches.match(request)) || Response.error()));
    return;
  }

  // Card and guide photos (public Supabase files): from the phone when offline
  if (url.hostname.endsWith(".supabase.co") && url.pathname.includes("/storage/v1/object/public/")) {
    event.respondWith(photo(request));
  }
});

// ───────── Phone notifications (Step 79) ─────────
// The server sends only a discreet title, a short line and where to open (lib/push/sender.ts).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Men's Social";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/brand/icon-192.png",
      badge: "/brand/badge-96.png",
      tag: data.tag || "ms",
      renotify: false,
      data: { link: typeof data.link === "string" && data.link.startsWith("/") ? data.link : "/man" },
    }),
  );
});

// Tapping it opens the app on that page (an open window is reused)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/man";
  const target = new URL(link, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (win) {
        win.focus();
        return win.navigate ? win.navigate(target).catch(() => win.postMessage({ type: "open", link })) : win.postMessage({ type: "open", link });
      }
      return self.clients.openWindow(target);
    }),
  );
});

// The phone changed its push address (it happens after updates): tell the app to register the new one next time it opens
self.addEventListener("pushsubscriptionchange", () => {
  // Nothing to do here without a signed-in session; the app re-registers on open (lib/notifications/push.ts).
});
