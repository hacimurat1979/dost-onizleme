/* B1: Çevrimdışı destek. Site vanilla kalıyor -- bu dosya tek başına bir
 * runtime bağımlılığı değil, tarayıcının kendi Service Worker API'si.
 *
 * Strateji bilerek muhafazakâr: JS/CSS için HER ZAMAN önce ağ denenir,
 * yalnız çevrimdışıyken önbelleğe düşülür -- "her zaman ağdan taze kod"
 * ile "çevrimdışı da açılsın" arasında, kodun aylarca eski bir önbellek
 * sürümünde takılı kalması riskini almadan bir denge. Veri (JSON) için
 * stale-while-revalidate: önce önbellek (hızlı + çevrimdışı çalışır),
 * arka planda ağdan güncellenir -- daha önce görülmüş bir kısmı tekrar
 * ziyaret etmek artık ağ gerektirmiyor.
 */
"use strict";

const CACHE_VERSION = "dost-sw-v1";
const SHELL_URLS = ["./", "./index.html", "./assets/style.css", "./assets/vendor/d3.min.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isDataRequest(url) {
  return url.pathname.includes("/data/ibn-arabi/") || url.pathname.includes("/data/themes.json");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Analytics vb. üçüncü taraf -- karışma.

  if (isDataRequest(url)) {
    // stale-while-revalidate: cache varsa hemen onu ver, arka planda tazele.
    event.respondWith(
      caches.open(CACHE_VERSION).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req)
            .then((resp) => { if (resp.ok) cache.put(req, resp.clone()); return resp; })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // Sayfalar + JS/CSS: önce ağ, yalnız çevrimdışıyken önbelleğe düş.
  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp.ok && (req.destination === "script" || req.destination === "style" || req.mode === "navigate")) {
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resp.clone()));
        }
        return resp;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || (req.mode === "navigate" ? caches.match("./index.html") : undefined))
      )
  );
});
