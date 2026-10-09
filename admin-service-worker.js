/* E2FIT Admin PWA shell cache.
   Supabase-backed records and authentication still require an internet connection. */
const CACHE_NAME = "e2fit-admin-shell-v1";
const APP_SHELL = [
  "./admin.html",
  "./admin.css?v=20261009-01",
  "./admin.js?v=20261009-07",
  "./supabase-config.js?v=20261006-2",
  "./assets/e2fit-logo.jpg",
  "./assets/e2fit-logo.png",
  "./assets/e2fit-pwa-icon.svg",
  "./admin.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("e2fit-admin-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const adminAsset = url.pathname.endsWith("/admin.html") || url.pathname.endsWith("/admin.css") || url.pathname.endsWith("/admin.js") || url.pathname.endsWith("/supabase-config.js") || url.pathname.endsWith("/admin.webmanifest") || url.pathname.endsWith("/e2fit-logo.jpg") || url.pathname.endsWith("/e2fit-logo.png") || url.pathname.endsWith("/e2fit-pwa-icon.svg");
  if (!adminAsset) return;

  if (request.mode === "navigate" && url.pathname.endsWith("/admin.html")) {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put("./admin.html", response.clone()));
        return response;
      }).catch(async () => (await caches.match(request)) || (await caches.match("./admin.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && response.type === "basic") {
          caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        }
        return response;
      });
    })
  );
});
