const CACHE = "sgic-v2";
const APP_SHELL = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const acceptsJson = request.headers.get("accept")?.includes("application/json");
  const isRpcOrApi = url.pathname.startsWith("/api/") || url.pathname.startsWith("/_server") || acceptsJson;

  // API, server functions and Supabase requests: network-only.
  if (isRpcOrApi || url.hostname.includes("supabase")) {
    event.respondWith(
      fetch(request).catch(() => new Response(
        JSON.stringify({ error: "offline", message: "Sin conexión. Intenta nuevamente cuando vuelvas a estar en línea." }),
        {
          status: 503,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        },
      ))
    );
    return;
  }

  // Navigation requests: network-first, offline fallback. Authenticated pages are never precached.
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match("/offline").then((offline) =>
        fetch(request).catch(() => offline || caches.match("/"))
      )
    );
    return;
  }

  // Static assets: cache-first, network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((res) => {
        if (res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || "SGIC", {
        body: data.body || "Nueva alerta",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: data.url || "/dashboard" },
        vibrate: [200, 100, 200],
        requireInteraction: true,
        tag: data.tag || "default",
      })
    );
  } catch {
    self.registration.showNotification("SGIC", { body: event.data.text(), icon: "/icon-192.png" });
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const client = clientList.find((c) => c.url === url);
      if (client) return client.focus();
      return clients.openWindow(url);
    })
  );
});
