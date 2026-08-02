/**
 * FAZ A (kozmik animasyonlar) -- 5 sahnenin paylaştığı küçük yardımcılar.
 * Sahne dosyalarının hiçbiri birbirine bağımlı değil; yalnız bunu paylaşıyorlar.
 */
window.DostKozmikUtils = (function () {
  "use strict";

  // Basit, hızlı, tohumlanabilir PRNG (mulberry32). Kripto güvenliği
  // gerekmiyor -- yalnız "her tecellî farklı" (lâ tekrâre fi't-tecellî)
  // ilkesini kodun içine somutlaştırmak için: aynı tohum aynı diziyi
  // üretir (test edilebilir), farklı tohum farklı bir yürüyüş üretir.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function freshSeed() {
    // Date.now() + kripto rastgeleliği: aynı milisaniyede iki döngü
    // başlarsa bile (olası değil, ama sahne yeniden mount edilebilir)
    // çakışmasın.
    const arr = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    return (Date.now() ^ arr[0]) >>> 0;
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // Mobil/düşük güçlü cihazlarda parçacık sayısını düşür. Tek, kaba ama
  // yeterli bir ölçü: viewport genişliği + donanım iş parçacığı sayısı.
  function particleScale() {
    const narrow = window.innerWidth < 640;
    const weak = (navigator.hardwareConcurrency || 4) <= 4;
    if (narrow && weak) return 0.35;
    if (narrow || weak) return 0.6;
    return 1;
  }

  // Sekme gizliyken sahneyi durdurmak için ortak kanca. `onHide`/`onShow`
  // çağrılır; dönen fonksiyon listener'ı kaldırır (destroy() içinde çağır).
  function watchVisibility(onHide, onShow) {
    function handler() {
      if (document.hidden) onHide();
      else onShow();
    }
    document.addEventListener("visibilitychange", handler);
    return function () {
      document.removeEventListener("visibilitychange", handler);
    };
  }

  return { mulberry32, freshSeed, prefersReducedMotion, particleScale, watchVisibility };
})();
