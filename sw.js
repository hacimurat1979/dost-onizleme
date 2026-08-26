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

const CACHE_VERSION = "dost-sw-v3";
const SHELL_URLS = ["./", "./index.html", "./assets/style.css", "./assets/vendor/d3-custom.min.js"];

self.addEventListener("install", (event) => {
  // cache.addAll() tarayıcının kendi HTTP önbelleğinden besleniyor -- satır
  // 60'taki "cache: reload" düzeltmesiyle aynı sebepten (GitHub Pages'in
  // Cache-Control: max-age=600'ü), install anında GÜNCEL sürüm yerine 10
  // dakikaya kadar eski bir kabuk önbelleğe yazılabiliyordu. Her URL ayrı
  // ayrı reload ile çekilip elle put ediliyor; bir URL 404 verirse (ör.
  // yeniden adlandırılmış bir vendor dosyası) yalnız o atlanır, TÜM install
  // addAll()'daki gibi sessizce başarısız olmaz.
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(
        SHELL_URLS.map((url) =>
          fetch(new Request(url, { cache: "reload" }))
            .then((resp) => { if (resp.ok) return cache.put(url, resp); })
            .catch(() => {})
        )
      )
    )
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
  // 2026-08-26 genişletme: yalnız /data/ibn-arabi/ ve themes.json'u kapsıyordu;
  // data/icerik/ (kademeli açılım, G15), data/kavramlar/ (kavram.js) ve
  // data/daphne* (Daphne profili/arşivi) hiç önbelleğe yazılmıyordu -- ne
  // stale-while-revalidate ne de pasif çevrimdışı düşme, bu betiğin kendi
  // üstteki "Veri için stale-while-revalidate" iddiasının aksine.
  return url.pathname.includes("/data/");
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
  // "cache: reload" şart -- yoksa fetch() tarayıcının kendi HTTP önbelleğinden
  // (GitHub Pages'in verdiği Cache-Control: max-age=600 sebebiyle) 10 dakikaya
  // kadar eski bir kopya döndürebilir ve "önce ağ" niyeti sessizce bozulur --
  // sayfayı ctrl+shift+r ile zorlamadan yeni sürümün görünmemesinin sebebi buydu.
  const isNavOrAsset = req.destination === "script" || req.destination === "style" || req.mode === "navigate";
  event.respondWith(
    fetch(isNavOrAsset ? new Request(req, { cache: "reload" }) : req)
      .then((resp) => {
        if (resp.ok && (req.destination === "script" || req.destination === "style" || req.mode === "navigate")) {
          // clone() HEMEN burada, senkron olarak: caches.open() bekleyen bir
          // await/then arasına düşerse, tarayıcı bu sırada return edilen
          // resp'in gövdesini okumaya başlıyor ve sonra çağrılan clone()
          // "Response body is already used" hatasıyla patlıyor -- konsolda
          // her navigasyonda görülen TypeError (2026-08-06, kullanıcı
          // bildirimi). Sonucu: cache.put() hiç tamamlanmıyor, SW'nin kendi
          // önbelleği asla tazelenmiyor, "yeni sürüm görünmüyor" şikâyetinin
          // asıl kaynağı satır 62'deki ctrl+shift+r notundan FARKLI bir kusurmuş.
          const toCache = resp.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, toCache));
        }
        return resp;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || (req.mode === "navigate" ? caches.match("./index.html") : undefined))
      )
  );
});
