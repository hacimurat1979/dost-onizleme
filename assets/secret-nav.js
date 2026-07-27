(function () {
  "use strict";
  // Gizli görünüm: ana navigasyonda yeri yok, sayfada "@daphne" yazınca
  // açılıyor. Kelime 2026-07-27'de "daphne"den "@daphne"ye çevrildi --
  // baştaki "@" düz yazı içinde tesadüfen oluşmasını imkânsız kılıyor
  // (aynı ölçü düzenleme kipinin "@revise"i için de geçerli).
  const CODE = "@daphne";
  let buffer = "";

  window.addEventListener("keydown", (e) => {
    if (e.key.length !== 1) return;
    // AltGr (Ctrl+Alt) Türkçe klavyede "@" üretiyor; bu bileşimi
    // engellemiyoruz, yoksa kelime hiç yazılamaz. Tek başına Ctrl/Alt
    // ya da Meta ise kısayoldur, geçilir.
    if (e.metaKey) return;
    if ((e.ctrlKey || e.altKey) && !(e.ctrlKey && e.altKey)) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    buffer = (buffer + e.key.toLowerCase()).slice(-CODE.length);
    if (buffer === CODE) {
      buffer = "";
      window.location.href = "compare.html";
    }
  });
})();
