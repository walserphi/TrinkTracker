const CACHE_NAME = "trinktracker-v7";
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./beispiel-daten.json",
  "./icons/icon.svg",
  "./icons/icon-maskable.svg",
];
const EXTERNAL_ASSETS = [
  "https://cdn.tailwindcss.com",
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);

      await Promise.all(
        EXTERNAL_ASSETS.map(async (url) => {
          try {
            const response = await fetch(new Request(url, { mode: "no-cors" }));
            if (response.ok || response.type === "opaque") {
              await cache.put(url, response);
            }
          } catch (error) {
            console.warn(`Offline-Kopie konnte nicht geladen werden: ${url}`, error);
          }
        }),
      );

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith("trinktracker-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin && !EXTERNAL_ASSETS.includes(request.url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          await cache.put("./index.html", response.clone());
          return response;
        } catch {
          const cachedPage = await caches.match("./index.html");
          if (cachedPage) return cachedPage;
          throw new Error("TrinkTracker ist offline und die App-Seite ist nicht zwischengespeichert.");
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) return cachedResponse;

      const response = await fetch(request);
      if (response.ok || response.type === "opaque") {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});
