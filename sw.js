const CACHE_NAME = "alahram-pwa-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js",
  "https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try { await cache.addAll(APP_SHELL); } catch (e) {}
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    if (req.mode === "navigate") {
      try {
        const fresh = await fetch(req);
        cache.put(req, fresh.clone()).catch(()=>{});
        return fresh;
      } catch {
        return (await cache.match(req)) || (await cache.match("./index.html")) || new Response("Offline", { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" }});
      }
    }

    try {
      const fresh = await fetch(req);
      if (fresh && fresh.status === 200) cache.put(req, fresh.clone()).catch(()=>{});
      return fresh;
    } catch {
      const cached = await cache.match(req);
      if (cached) return cached;
      return new Response("", { status: 504, statusText: "Offline" });
    }
  })());
});