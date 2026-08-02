/**
 * FAZ A: gsap/three.js'i yalnız "kozmik" görünümü açıldığında, SRI
 * korumalı <script> etiketleriyle dinamik olarak yükler -- diğer hiçbir
 * sayfanın ilk yükleme maliyetine binmez.
 *
 * SRI notu (FAZ A denetiminde elle doğrulandı): three.js artık global/UMD
 * derlemesi sunmuyor, yalnız ESM. Bir ESM <script>'in `integrity`'si
 * yalnız KENDİ dosyasını doğrular, `import` ettiği dosyaları DEĞİL. Bunu
 * aşmak için three.js'in üç parçası (core + module + köprü) AYRI AYRI,
 * her biri kendi integrity'siyle <script type="module"> etiketi olarak
 * ekleniyor -- tarayıcının modül haritası URL bazlı ve paylaşılan olduğu
 * için (elle test edildi: core dosyası kasıtlı bozulup hash aynı
 * bırakıldığında tarayıcı SESSİZCE DEĞİL, açık bir integrity hatasıyla
 * bloke etti) bu üçünün hepsi gerçekten korunuyor.
 *
 * HASH_TABLE aşağıda scripts/sri-guncelle.py tarafından OTOMATİK
 * tazelenir (bkz. o betikteki KOZMIK_HASH_START/END işaretleri) -- elle
 * düzenleme yapılırsa bir sonraki `kontrol.py` çalıştırmasında ezilir.
 */
window.DostKozmikLoader = (function () {
  "use strict";

  // KOZMIK_HASH_START -- scripts/sri-guncelle.py bu bloğu tazeler, elle değiştirme.
  const HASHES = {
    "assets/vendor/gsap/gsap.min.js": "sha384-XmJ9SoHtVOHoQUcKvFAzVXwdkKo1Ie3bhmSoIAkcdsHGaIrVJIkmozyq0FJeb/Ly",
    "assets/vendor/three/three.core.min.js": "sha384-rx+KIp/9ptjArhnFAcpVoOc/ynktDsRtRJKIbC7YVKylEvFu8sgmzk9RmQ+CIV48",
    "assets/vendor/three/three.module.min.js": "sha384-QHQk1LzjJlJYNdthXjKCmffpDRZL3EqJ7LfqBzyKyvGgjAYM2ZVuYtFGg42NcAJ/",
    "assets/vendor/three/three-bridge.js": "sha384-eyqsQi/7etxftso5qeCjdK8cioeGAFi0fho1TH12oI86E3wPHGYlxNFD1rYbBWqI",
  };
  // KOZMIK_HASH_END

  const loaded = new Set();

  function loadScript(src, opts) {
    opts = opts || {};
    if (loaded.has(src)) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = src;
      if (opts.module) s.type = "module";
      const hash = HASHES[src];
      if (hash) s.integrity = hash;
      s.onload = function () {
        loaded.add(src);
        resolve();
      };
      s.onerror = function () {
        reject(new Error("Yüklenemedi (SRI uyuşmazlığı olabilir): " + src));
      };
      document.head.appendChild(s);
    });
  }

  function loadGsap() {
    if (window.gsap) return Promise.resolve(window.gsap);
    return loadScript("assets/vendor/gsap/gsap.min.js").then(function () {
      return window.gsap;
    });
  }

  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    return loadScript("assets/vendor/three/three.core.min.js", { module: true })
      .then(function () {
        return loadScript("assets/vendor/three/three.module.min.js", { module: true });
      })
      .then(function () {
        return new Promise(function (resolve, reject) {
          if (window.THREE) return resolve(window.THREE);
          window.addEventListener("dost:three-ready", function onReady() {
            window.removeEventListener("dost:three-ready", onReady);
            resolve(window.THREE);
          });
          loadScript("assets/vendor/three/three-bridge.js", { module: true }).catch(reject);
        });
      });
  }

  return { loadGsap, loadThree };
})();
