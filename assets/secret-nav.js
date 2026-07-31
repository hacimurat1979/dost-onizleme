(function () {
  "use strict";
  // Gizli görünümler: ana navigasyonda yeri yok.
  // "@daphne" yazınca compare.html açılıyor (Perde ve Ayna sekmeleri dahil).
  // Baştaki "@" düz yazı içinde tesadüfen oluşmasını imkânsız kılıyor
  // (aynı ölçü düzenleme kipinin "@revise"i için de geçerli).
  const CODES = {
    "@daphne": "compare.html",
  };
  const MAX_LEN = Math.max(...Object.keys(CODES).map(k => k.length));
  let buffer = "";

  window.addEventListener("keydown", (e) => {
    if (e.key.length !== 1) return;
    // AltGr (Ctrl+Alt) Türkçe klavyede "@" üretiyor; bu bileşimi
    // engellemiyoruz, yoksa kelimeler hiç yazılamaz. Tek başına Ctrl/Alt
    // ya da Meta ise kısayoldur, geçilir.
    if (e.metaKey) return;
    if ((e.ctrlKey || e.altKey) && !(e.ctrlKey && e.altKey)) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    buffer = (buffer + e.key.toLowerCase()).slice(-MAX_LEN);
    for (const [code, dest] of Object.entries(CODES)) {
      if (buffer.endsWith(code)) {
        buffer = "";
        window.location.href = dest;
        return;
      }
    }
  });
})();
